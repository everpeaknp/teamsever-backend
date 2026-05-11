#!/usr/bin/env node
const mongoose = require("mongoose");
require("dotenv").config();

const Conversation = require("../dist/models/Conversation");
const DirectMessage = require("../dist/models/DirectMessage");
const Attachment = require("../dist/models/Attachment");
const Notification = require("../dist/models/Notification");

function normalizeId(id) {
  if (!id) return null;
  return id.toString();
}

function buildKey(workspaceId, participants) {
  const sorted = (participants || []).map(normalizeId).filter(Boolean).sort();
  if (!workspaceId || sorted.length !== 2) return null;
  return `${workspaceId}:${sorted[0]}:${sorted[1]}`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error("Missing MONGODB_URI in environment.");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log(`Connected to MongoDB (${dryRun ? "DRY RUN" : "LIVE"})`);

  const conversations = await Conversation.find({})
    .select("_id workspace participants lastMessageAt createdAt")
    .lean();

  const groups = new Map();
  for (const c of conversations) {
    const key = buildKey(normalizeId(c.workspace), c.participants);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  let duplicateSets = 0;
  let duplicateConversations = 0;
  let movedMessages = 0;
  let movedAttachments = 0;
  let updatedNotifications = 0;
  let deletedConversations = 0;

  for (const [key, group] of groups.entries()) {
    if (group.length <= 1) continue;

    duplicateSets += 1;
    duplicateConversations += group.length - 1;

    group.sort((a, b) => {
      const aTime = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    const keeper = group[0];
    const dupes = group.slice(1);
    const dupeIds = dupes.map((d) => d._id);

    console.log(
      `\n[${key}] keeping ${keeper._id.toString()} and merging ${dupeIds.length} duplicate conversation(s)`
    );

    const msgRes = await DirectMessage.updateMany(
      { conversation: { $in: dupeIds } },
      { $set: { conversation: keeper._id } }
    );
    movedMessages += msgRes.modifiedCount || 0;

    const attachRes = await Attachment.updateMany(
      { conversation: { $in: dupeIds } },
      { $set: { conversation: keeper._id } }
    );
    movedAttachments += attachRes.modifiedCount || 0;

    let notifCountForKey = 0;
    for (const dupeId of dupeIds) {
      const dupeStr = dupeId.toString();
      const notifRes = await Notification.updateMany(
        {
          $or: [
            { "data.conversationId": dupeStr },
            { "data.conversationId": dupeId },
            { "data.resourceId": dupeStr },
            { "data.resourceId": dupeId },
          ],
        },
        {
          $set: {
            "data.conversationId": keeper._id.toString(),
            "data.resourceId": keeper._id.toString(),
          },
        }
      );
      notifCountForKey += notifRes.modifiedCount || 0;
    }
    updatedNotifications += notifCountForKey;

    const newestMessage = await DirectMessage.findOne({ conversation: keeper._id })
      .sort({ createdAt: -1 })
      .select("_id createdAt")
      .lean();

    if (!dryRun) {
      await Conversation.updateOne(
        { _id: keeper._id },
        {
          $set: {
            conversationKey: key,
            lastMessage: newestMessage?._id || null,
            lastMessageAt: newestMessage?.createdAt || keeper.lastMessageAt || new Date(),
          },
        }
      );
      const delRes = await Conversation.deleteMany({ _id: { $in: dupeIds } });
      deletedConversations += delRes.deletedCount || 0;
    }
  }

  if (!dryRun) {
    const missingKey = await Conversation.find({
      $or: [{ conversationKey: { $exists: false } }, { conversationKey: null }, { conversationKey: "" }],
    })
      .select("_id workspace participants")
      .lean();

    for (const c of missingKey) {
      const key = buildKey(normalizeId(c.workspace), c.participants);
      if (!key) continue;
      await Conversation.updateOne({ _id: c._id }, { $set: { conversationKey: key } });
    }
  }

  console.log("\n=== DM De-dup Summary ===");
  console.log(`Duplicate sets found: ${duplicateSets}`);
  console.log(`Duplicate conversation docs: ${duplicateConversations}`);
  console.log(`Messages re-pointed: ${movedMessages}`);
  console.log(`Attachments re-pointed: ${movedAttachments}`);
  console.log(`Notifications updated: ${updatedNotifications}`);
  console.log(`Conversations deleted: ${deletedConversations}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no deletes/writes for conversations)" : "LIVE"}`);

  await mongoose.disconnect();
  console.log("Disconnected.");
}

main().catch(async (err) => {
  console.error("dedup-dm-conversations failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

