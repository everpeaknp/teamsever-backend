import mongoose from "mongoose";

/**
 * Build an atomic per-message reaction toggle. The update pipeline removes the
 * user's previous reaction(s) before adding the requested one, preventing
 * concurrent requests from pushing duplicate user ids into a reaction.
 */
export function reactionTogglePipeline(userId: string, emoji: string) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const currentReactions = { $ifNull: ["$reactions", []] };

  const hadSameEmoji = {
    $anyElementTrue: [
      {
        $map: {
          input: "$$current",
          as: "reaction",
          in: {
            $and: [
              { $eq: ["$$reaction.emoji", emoji] },
              { $in: [userObjectId, { $ifNull: ["$$reaction.users", []] }] },
            ],
          },
        },
      },
    ],
  };

  const removeUserAndEmptyReactions = {
    $filter: {
      input: {
        $map: {
          input: "$$current",
          as: "reaction",
          in: {
            $let: {
              vars: {
                remainingUsers: {
                  $filter: {
                    input: { $ifNull: ["$$reaction.users", []] },
                    as: "reactor",
                    cond: { $ne: ["$$reactor", userObjectId] },
                  },
                },
              },
              in: {
                $mergeObjects: [
                  "$$reaction",
                  {
                    users: "$$remainingUsers",
                    count: { $size: "$$remainingUsers" },
                  },
                ],
              },
            },
          },
        },
      },
      as: "reaction",
      cond: { $gt: [{ $size: "$$reaction.users" }, 0] },
    },
  };

  const addRequestedReaction = {
    $let: {
      vars: {
        cleaned: {
          $let: {
            vars: { nonEmpty: removeUserAndEmptyReactions },
            in: {
              $map: {
                input: {
                  $setUnion: [
                    {
                      $map: {
                        input: "$$nonEmpty",
                        as: "reaction",
                        in: "$$reaction.emoji",
                      },
                    },
                    [],
                  ],
                },
                as: "emoji",
                in: {
                  $let: {
                    vars: {
                      users: {
                        $reduce: {
                          input: {
                            $filter: {
                              input: "$$nonEmpty",
                              as: "reaction",
                              cond: { $eq: ["$$reaction.emoji", "$$emoji"] },
                            },
                          },
                          initialValue: [],
                          in: { $setUnion: ["$$value", "$$this.users"] },
                        },
                      },
                    },
                    in: {
                      emoji: "$$emoji",
                      users: "$$users",
                      count: { $size: "$$users" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      in: {
        $let: {
          vars: {
            emojiExists: {
              $anyElementTrue: [
                {
                  $map: {
                    input: "$$cleaned",
                    as: "reaction",
                    in: { $eq: ["$$reaction.emoji", emoji] },
                  },
                },
              ],
            },
          },
          in: {
            $cond: [
              "$$emojiExists",
              {
                $map: {
                  input: "$$cleaned",
                  as: "reaction",
                  in: {
                    $cond: [
                      { $eq: ["$$reaction.emoji", emoji] },
                      {
                        $let: {
                          vars: {
                            users: {
                              $setUnion: ["$$reaction.users", [userObjectId]],
                            },
                          },
                          in: {
                            $mergeObjects: [
                              "$$reaction",
                              { users: "$$users", count: { $size: "$$users" } },
                            ],
                          },
                        },
                      },
                      "$$reaction",
                    ],
                  },
                },
              },
              {
                $concatArrays: [
                  "$$cleaned",
                  [{ emoji, users: [userObjectId], count: 1 }],
                ],
              },
            ],
          },
        },
      },
    },
  };

  return [
    {
      $set: {
        reactions: {
          $let: {
            vars: { current: currentReactions },
            in: {
              $cond: [
                hadSameEmoji,
                removeUserAndEmptyReactions,
                addRequestedReaction,
              ],
            },
          },
        },
      },
    },
  ];
}
