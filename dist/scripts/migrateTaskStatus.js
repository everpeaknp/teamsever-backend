"use strict";
/**
 * Migration script to update task status values from old format to new format
 * Run this once to migrate existing data
 */
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const Task = require('../models/Task');
const statusMapping = {
    'to do': 'todo',
    'in progress': 'inprogress',
    'in-progress': 'inprogress',
    'blocked': 'cancelled',
};
async function migrateTaskStatus() {
    try {
        console.log('🔄 Connecting to database...');
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI or MONGO_URI environment variable is not defined');
        }
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to database');
        console.log('\n🔄 Starting task status migration...');
        // Find all tasks with old status values
        const tasksToUpdate = await Task.find({
            status: { $in: ['to do', 'in progress', 'in-progress', 'blocked'] },
            isDeleted: false
        });
        console.log(`📊 Found ${tasksToUpdate.length} tasks to migrate`);
        let updated = 0;
        let errors = 0;
        for (const task of tasksToUpdate) {
            try {
                const oldStatus = task.status;
                const newStatus = statusMapping[oldStatus] || oldStatus;
                if (oldStatus !== newStatus) {
                    task.status = newStatus;
                    await task.save();
                    updated++;
                    console.log(`✓ Updated task "${task.title}" from "${oldStatus}" to "${newStatus}"`);
                }
            }
            catch (error) {
                errors++;
                console.error(`✗ Failed to update task "${task.title}":`, error);
            }
        }
        console.log('\n📊 Migration Summary:');
        console.log(`   Total tasks found: ${tasksToUpdate.length}`);
        console.log(`   Successfully updated: ${updated}`);
        console.log(`   Errors: ${errors}`);
        console.log('\n✅ Migration completed!');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}
// Run migration
migrateTaskStatus();
