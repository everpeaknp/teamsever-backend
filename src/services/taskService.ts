const Task = require("../models/Task");
const List = require("../models/List");
const Space = require("../models/Space");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const softDelete = require("../utils/softDelete");
const logger = require("../utils/logger");
const { emitSpaceEvent, emitTaskEvent } = require("../socket/events");
const socketService = require("./socketService").default;
const enhancedNotificationService = require("./enhancedNotificationService");
const customFieldService = require("./customFieldService");
const taskDependencyService = require("./taskDependencyService");

interface CreateTaskData {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  startDate?: Date;
  dueDate?: Date;
  deadline?: Date;
  isMilestone?: boolean;
  list: string;
  assignee?: string;
  createdBy: string;
  customFieldValues?: Array<{ field: string; value: any }>;
  // Recurrence fields
  isRecurring?: boolean;
  frequency?: "daily" | "weekly" | "monthly" | "custom";
  interval?: number;
  nextOccurrence?: Date;
  recurrenceEnd?: Date;
}

interface UpdateTaskData {
  title?: string;
  description?: string;
  status?: "todo" | "inprogress" | "done" | "cancelled";
  priority?: "low" | "medium" | "high" | "urgent";
  startDate?: Date;
  dueDate?: Date;
  deadline?: Date;
  assignee?: string;
  assigneeId?: string;
  isMilestone?: boolean;
  customFieldValues?: Array<{ field: string; value: any }>;
  // Recurrence fields
  isRecurring?: boolean;
  frequency?: "daily" | "weekly" | "monthly" | "custom";
  interval?: number;
  nextOccurrence?: Date;
  recurrenceEnd?: Date;
}

class TaskService {
  async createTask(data: CreateTaskData) {
    const { title, description, priority, dueDate, list: listId, assignee, createdBy } = data;

    // Verify list exists
    const list = await List.findOne({
      _id: listId,
      isDeleted: false
    });

    if (!list) {
      throw new AppError("List not found", 404);
    }

    // Verify space exists
    const space = await Space.findOne({
      _id: list.space,
      isDeleted: false
    });

    if (!space) {
      throw new AppError("Space not found", 404);
    }

    // Verify user is workspace member
    const workspace = await Workspace.findOne({
      _id: list.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    // Safety check: ensure members array exists
    if (!workspace.members || !Array.isArray(workspace.members)) {
      console.error(`[Task] Workspace ${list.workspace} has invalid members array`);
      throw new AppError("Workspace configuration error", 500);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === createdBy
    );

    if (!isMember) {
      throw new AppError("You must be a workspace member to create a task", 403);
    }

    // Validate custom field values if provided
    let validatedCustomFieldValues = [];
    if (data.customFieldValues && data.customFieldValues.length > 0) {
      validatedCustomFieldValues = await customFieldService.validateCustomFieldValues(
        data.customFieldValues,
        list.workspace.toString(),
        list.space.toString()
      );
    }

    // Create task with denormalized fields
    const taskData: any = {
      title,
      description,
      priority,
      startDate: data.startDate,
      dueDate,
      deadline: data.deadline,
      isMilestone: data.isMilestone || false,
      list: listId,
      space: list.space,
      workspace: list.workspace,
      assignee,
      createdBy,
      customFieldValues: validatedCustomFieldValues,
      // Recurrence fields
      isRecurring: data.isRecurring || false,
      frequency: data.frequency,
      interval: data.interval || 1,
      nextOccurrence: data.nextOccurrence,
      recurrenceEnd: data.recurrenceEnd
    };

    // Enforce milestone constraint: startDate === dueDate (duration = 0)
    if (taskData.isMilestone && taskData.dueDate) {
      taskData.startDate = taskData.dueDate;
    }

    const task = await Task.create(taskData);

    // Invalidate usage cache for workspace owner
    try {
      const EntitlementService = require('./entitlementService').default;
      EntitlementService.invalidateUsageCache(workspace.owner.toString());
    } catch (error) {
      console.error("[Task] Failed to invalidate usage cache:", error);
    }

    // Log activity
    await logger.logActivity({
      userId: createdBy,
      workspaceId: list.workspace.toString(),
      action: "CREATE",
      resourceType: "Task",
      resourceId: task._id.toString(),
      metadata: { title: task.title, listId, spaceId: list.space }
    });

    // Create activity entry for task creation
    try {
      const Activity = require("../models/Activity");
      await Activity.create({
        task: task._id,
        user: createdBy,
        workspace: list.workspace,
        type: "update",
        fieldChanged: "title",
        oldValue: null,
        newValue: task.title,
        isSystemGenerated: false,
      });
    } catch (error) {
      console.error("[Task] Failed to create activity for task creation:", error);
      // Don't fail task creation if activity logging fails
    }

    // Emit real-time event to space
    try {
      emitSpaceEvent(
        list.space.toString(),
        "task_created",
        {
          task: {
            _id: task._id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            list: task.list,
            assignee: task.assignee
          }
        },
        createdBy
      );
    } catch (error) {
      console.error("Failed to emit task_created event:", error);
    }

    // Send notification to assignee using enhanced notification service
    if (assignee && assignee !== createdBy) {
      // Don't await - run asynchronously to not block task creation
      enhancedNotificationService.notifyTaskUpdate(
        task._id.toString(),
        createdBy,
        "assignee",
        null,
        assignee
      ).catch((error: any) => {
        console.error("Failed to send task assignment notification:", error);
      });
    }

    return task;
  }

  async getListTasks(listId: string, userId: string, filters?: any) {
    // Verify list exists and user has access
    const list = await List.findOne({
      _id: listId,
      isDeleted: false
    });

    if (!list) {
      throw new AppError("List not found", 404);
    }

    // Verify user is workspace member
    const workspace = await Workspace.findOne({
      _id: list.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this list", 403);
    }

    // Build query
    const query: any = {
      list: listId,
      isDeleted: false
    };

    if (filters?.status) query.status = filters.status;
    if (filters?.priority) query.priority = filters.priority;
    if (filters?.assignee) query.assignee = filters.assignee;

    // Custom field filtering
    // Format: ?customField.fieldId=value
    if (filters?.customField) {
      for (const [fieldId, value] of Object.entries(filters.customField)) {
        query.customFieldValues = {
          $elemMatch: {
            field: fieldId,
            value: value
          }
        };
      }
    }

    const tasks = await Task.find(query)
      .populate("assignee", "name email profilePicture")
      .populate("createdBy", "name email profilePicture")
      .populate("customFieldValues.field", "name type options")
      .sort("-createdAt")
      .lean();

    return tasks;
  }

  async getTaskById(taskId: string, userId: string) {
    const task = await Task.findOne({
      _id: taskId,
      isDeleted: false
    })
      .populate("assignee", "name email profilePicture")
      .populate("createdBy", "name email profilePicture")
      .populate("list", "name")
      .populate({
        path: "list",
        populate: {
          path: "space",
          select: "name workspace",
          populate: {
            path: "workspace",
            select: "name"
          }
        }
      })
      .lean();

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    // Verify user is workspace member
    const workspace = await Workspace.findOne({
      _id: task.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this task", 403);
    }

    // Fetch comments and activity separately for better control
    const [comments, activity, attachments] = await Promise.all([
      require("../models/TaskComment").find({ task: taskId, isDeleted: false })
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .lean(),
      require("../models/Activity").find({ task: taskId })
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .lean(),
      require("../models/Attachment").find({ task: taskId, isDeleted: false })
        .populate("uploadedBy", "name email")
        .sort({ createdAt: -1 })
        .lean()
    ]);

    return {
      ...task,
      comments,
      activity,
      attachments
    };    return task;
  }

  async updateTask(taskId: string, userId: string, updateData: UpdateTaskData) {
    const task = await Task.findOne({
      _id: taskId,
      isDeleted: false
    });

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    // Permission check is handled by middleware (requirePermission("EDIT_TASK"))
    // No need for additional checks here

    // Check dependency blocking if status is changing
    if (updateData.status && updateData.status !== task.status) {
      const canTransition = await taskDependencyService.canTransitionToStatus(
        taskId,
        updateData.status
      );

      if (!canTransition.allowed) {
        throw new AppError(
          canTransition.reason || "Task is blocked by dependencies",
          400
        );
      }
    }

    // Capture old state for audit and notifications
    const oldValue = task.toObject();
    const statusChanged = !!(updateData.status && updateData.status !== task.status);
    const priorityChanged = !!(updateData.priority && updateData.priority !== task.priority);
    const assigneeChanged = updateData.assignee !== undefined && updateData.assignee !== task.assignee?.toString();
    const oldAssignee = task.assignee?.toString();

    if (updateData.title) task.title = updateData.title;
    if (updateData.description !== undefined) task.description = updateData.description;
    if (updateData.status) {
      const oldStatus = task.status;
      task.status = updateData.status;
      
      // Handle completedAt and completedBy fields
      if (updateData.status === "done" && oldStatus !== "done") {
        // Task was just completed
        task.completedAt = new Date();
        task.completedBy = userId;
      } else if (updateData.status !== "done" && oldStatus === "done") {
        // Task was moved back from Done
        task.completedAt = undefined;
        task.completedBy = undefined;
      }
    }
    if (updateData.priority) task.priority = updateData.priority;
    if (updateData.startDate !== undefined) task.startDate = updateData.startDate;
    if (updateData.dueDate !== undefined) task.dueDate = updateData.dueDate;
    if (updateData.deadline !== undefined) task.deadline = updateData.deadline;
    // Handle both assignee and assigneeId (assigneeId is an alias)
    if (updateData.assignee !== undefined) task.assignee = updateData.assignee;
    if (updateData.assigneeId !== undefined) task.assignee = updateData.assigneeId;
    if (updateData.isMilestone !== undefined) task.isMilestone = updateData.isMilestone;

    // Enforce milestone constraint: startDate === dueDate (duration = 0)
    if (task.isMilestone && task.dueDate) {
      task.startDate = task.dueDate;
    }

    // Update recurrence fields
    if (updateData.isRecurring !== undefined) task.isRecurring = updateData.isRecurring;
    if (updateData.frequency) task.frequency = updateData.frequency;
    if (updateData.interval !== undefined) task.interval = updateData.interval;
    if (updateData.nextOccurrence !== undefined) task.nextOccurrence = updateData.nextOccurrence;
    if (updateData.recurrenceEnd !== undefined) task.recurrenceEnd = updateData.recurrenceEnd;

    // Validate and update custom field values if provided
    if (updateData.customFieldValues) {
      const validatedCustomFieldValues = await customFieldService.validateCustomFieldValues(
        updateData.customFieldValues,
        task.workspace.toString(),
        task.space.toString()
      );
      task.customFieldValues = validatedCustomFieldValues;
    }

    await task.save();

    // Populate for response
    await task.populate("assignee", "name email profilePicture");
    await task.populate("createdBy", "name email profilePicture");

    // Track important field changes as activities
    await this.trackFieldChanges(
      taskId,
      userId,
      task.workspace.toString(),
      oldValue,
      {
        status: task.status,
        assignee: task.assignee,
        priority: task.priority,
        dueDate: task.dueDate,
        startDate: task.startDate,
        title: task.title,
        description: task.description,
      }
    );

    // Log audit
    await logger.logAudit({
      userId,
      workspaceId: task.workspace.toString(),
      resourceType: "Task",
      resourceId: task._id.toString(),
      oldValue,
      newValue: task.toObject()
    });

    // Log activity
    await logger.logActivity({
      userId,
      workspaceId: task.workspace.toString(),
      action: statusChanged ? "STATUS_CHANGE" : "UPDATE",
      resourceType: "Task",
      resourceId: task._id.toString(),
      metadata: statusChanged ? { oldStatus: oldValue.status, newStatus: task.status } : undefined
    });

    // Emit real-time events and send notifications
    await this.emitTaskUpdateEvents(
      task,
      oldValue,
      userId,
      statusChanged,
      priorityChanged,
      assigneeChanged,
      oldAssignee,
      updateData
    );

    return task;
  }

  /**
   * Emit task update events and send notifications to offline users
   */
  private async emitTaskUpdateEvents(
    task: any,
    oldValue: any,
    userId: string,
    statusChanged: boolean,
    priorityChanged: boolean,
    assigneeChanged: boolean,
    oldAssignee: string | undefined,
    updateData: UpdateTaskData
  ): Promise<void> {
    try {
      const eventData = {
        task: {
          _id: task._id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          assignee: task.assignee,
          dueDate: task.dueDate,
        },
        changes: updateData,
        statusChanged,
        priorityChanged,
        assigneeChanged,
      };

      // Emit to task room (all users watching this task)
      const eventType = statusChanged ? "status_changed" : "updated";
      emitTaskEvent(task._id.toString(), eventType, eventData, userId);

      // Also emit to space room for status changes
      if (statusChanged) {
        emitSpaceEvent(
          task.space.toString(),
          "task_updated",
          {
            task: {
              _id: task._id,
              title: task.title,
              status: task.status,
              oldStatus: oldValue.status,
            },
          },
          userId
        );
      }

      // Send notifications using enhanced notification service
      // This handles both online (socket) and offline (FCM push) users automatically
      if (statusChanged) {
        await enhancedNotificationService.notifyTaskUpdate(
          task._id.toString(),
          userId,
          "status",
          oldValue.status,
          task.status
        );
      } else if (priorityChanged) {
        await enhancedNotificationService.notifyTaskUpdate(
          task._id.toString(),
          userId,
          "priority",
          oldValue.priority,
          task.priority
        );
      } else if (assigneeChanged) {
        await enhancedNotificationService.notifyTaskUpdate(
          task._id.toString(),
          userId,
          "assignee",
          oldAssignee,
          task.assignee?.toString()
        );
      } else {
        // General update
        await enhancedNotificationService.notifyTaskUpdate(
          task._id.toString(),
          userId,
          "general",
          null,
          null
        );
      }
    } catch (error) {
      console.error("[Task] Failed to emit update events:", error);
    }
  }

  async deleteTask(taskId: string, userId: string) {
    const task = await Task.findOne({
      _id: taskId,
      isDeleted: false
    });

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    // Permission check is handled by middleware (requirePermission("DELETE_TASK"))
    // No need for additional checks here

    // Soft delete the task first
    await softDelete(Task, taskId);

    // Get workspace to find owner and invalidate cache AFTER deletion
    const Workspace = require('../models/Workspace');
    const workspace = await Workspace.findById(task.workspace);
    if (workspace) {
      // Invalidate usage cache for workspace owner
      const EntitlementService = require('./entitlementService').default;
      EntitlementService.invalidateUsageCache(workspace.owner.toString());
    }

    // Delete associated attachments
    try {
      const attachmentService = require("./attachmentService");
      const deletedCount = await attachmentService.deleteTaskAttachments(taskId);
    } catch (error) {
      console.error("[Task] Failed to delete attachments:", error);
      // Don't fail task deletion if attachment cleanup fails
    }

    // Log activity
    await logger.logActivity({
      userId,
      workspaceId: task.workspace.toString(),
      action: "DELETE",
      resourceType: "Task",
      resourceId: task._id.toString()
    });

    // Emit real-time event
    try {
      emitSpaceEvent(
        task.space.toString(),
        "task_deleted",
        {
          taskId: task._id.toString(),
          title: task.title
        },
        userId
      );
    } catch (error) {
      console.error("Failed to emit task_deleted event:", error);
    }

    return { message: "Task deleted successfully" };
  }

  /**
   * Create a subtask under a parent task
   */
  async createSubtask(parentTaskId: string, userId: string, data: CreateTaskData) {
    const { title, description, priority, dueDate, assignee } = data;

    // Verify parent task exists
    const parentTask = await Task.findOne({
      _id: parentTaskId,
      isDeleted: false
    });

    if (!parentTask) {
      throw new AppError("Parent task not found", 404);
    }

    // Verify user has access to workspace
    const workspace = await Workspace.findOne({
      _id: parentTask.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You must be a workspace member to create a subtask", 403);
    }

    // Create subtask with parent reference
    const subtask = await Task.create({
      title,
      description,
      priority,
      dueDate,
      list: parentTask.list,
      space: parentTask.space,
      workspace: parentTask.workspace,
      assignee,
      createdBy: userId,
      parentTask: parentTaskId
    });

    // Add subtask to parent's subTasks array
    parentTask.subTasks.push(subtask._id);
    await parentTask.save();

    // Log activity
    await logger.logActivity({
      userId,
      workspaceId: parentTask.workspace.toString(),
      action: "CREATE",
      resourceType: "Subtask",
      resourceId: subtask._id.toString(),
      metadata: { 
        title: subtask.title, 
        parentTaskId,
        parentTaskTitle: parentTask.title 
      }
    });

    // Emit real-time event
    try {
      emitTaskEvent(
        parentTaskId,
        "subtask_created",
        {
          subtask: {
            _id: subtask._id,
            title: subtask.title,
            status: subtask.status,
            priority: subtask.priority,
            parentTask: parentTaskId
          }
        },
        userId
      );
    } catch (error) {
      console.error("Failed to emit subtask_created event:", error);
    }

    // Notify parent task assignee
    if (parentTask.assignee && parentTask.assignee.toString() !== userId) {
      enhancedNotificationService.notifySubtaskCreated(
        parentTaskId,
        subtask._id.toString(),
        userId
      ).catch((error: any) => {
        console.error("Failed to send subtask notification:", error);
      });
    }

    return subtask;
  }

  /**
   * Get all subtasks of a parent task
   */
  async getSubtasks(parentTaskId: string, userId: string) {
    // Verify parent task exists and user has access
    const parentTask = await Task.findOne({
      _id: parentTaskId,
      isDeleted: false
    });

    if (!parentTask) {
      throw new AppError("Parent task not found", 404);
    }

    // Verify user is workspace member
    const workspace = await Workspace.findOne({
      _id: parentTask.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this task", 403);
    }

    // Get all subtasks
    const subtasks = await Task.find({
      parentTask: parentTaskId,
      isDeleted: false
    })
      .populate("assignee", "name email profilePicture")
      .populate("createdBy", "name email profilePicture")
      .sort("createdAt")
      .lean();

    return subtasks;
  }

  /**
   * Add a dependency to a task
   */
  async addDependency(taskId: string, dependencyTaskId: string, userId: string) {
    // Verify both tasks exist
    const [task, dependencyTask] = await Promise.all([
      Task.findOne({ _id: taskId, isDeleted: false }),
      Task.findOne({ _id: dependencyTaskId, isDeleted: false })
    ]);

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    if (!dependencyTask) {
      throw new AppError("Dependency task not found", 404);
    }

    // Validate: tasks must be in same workspace
    if (task.workspace.toString() !== dependencyTask.workspace.toString()) {
      throw new AppError("Tasks must be in the same workspace", 400);
    }

    // Verify user has access
    const workspace = await Workspace.findOne({
      _id: task.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this task", 403);
    }

    // Check if dependency already exists
    if (task.dependencies.some((dep: any) => dep.toString() === dependencyTaskId)) {
      throw new AppError("Dependency already exists", 400);
    }

    // Prevent self-dependency
    if (taskId === dependencyTaskId) {
      throw new AppError("A task cannot depend on itself", 400);
    }

    // Check for circular dependencies
    const hasCircularDependency = await this.checkCircularDependency(
      dependencyTaskId,
      taskId
    );

    if (hasCircularDependency) {
      throw new AppError(
        "Cannot add dependency: This would create a circular dependency",
        400
      );
    }

    // Add dependency
    task.dependencies.push(dependencyTask._id);
    dependencyTask.dependents.push(task._id);

    await Promise.all([task.save(), dependencyTask.save()]);

    // Log activity
    await logger.logActivity({
      userId,
      workspaceId: task.workspace.toString(),
      action: "ADD_DEPENDENCY",
      resourceType: "Task",
      resourceId: task._id.toString(),
      metadata: {
        dependencyTaskId,
        dependencyTaskTitle: dependencyTask.title
      }
    });

    // Emit real-time events
    try {
      emitTaskEvent(
        taskId,
        "dependency_added",
        {
          task: {
            _id: task._id,
            title: task.title
          },
          dependency: {
            _id: dependencyTask._id,
            title: dependencyTask.title,
            status: dependencyTask.status
          }
        },
        userId
      );

      emitTaskEvent(
        dependencyTaskId,
        "dependent_added",
        {
          task: {
            _id: dependencyTask._id,
            title: dependencyTask.title
          },
          dependent: {
            _id: task._id,
            title: task.title,
            status: task.status
          }
        },
        userId
      );
    } catch (error) {
      console.error("Failed to emit dependency events:", error);
    }

    // Notify assignees
    if (task.assignee && task.assignee.toString() !== userId) {
      enhancedNotificationService.notifyDependencyAdded(
        taskId,
        dependencyTaskId,
        userId,
        "blocker"
      ).catch((error: any) => {
        console.error("Failed to send dependency notification:", error);
      });
    }

    if (dependencyTask.assignee && dependencyTask.assignee.toString() !== userId) {
      enhancedNotificationService.notifyDependencyAdded(
        dependencyTaskId,
        taskId,
        userId,
        "dependent"
      ).catch((error: any) => {
        console.error("Failed to send dependent notification:", error);
      });
    }

    return {
      task: await task.populate("dependencies", "title status priority"),
      dependencyTask: await dependencyTask.populate("dependents", "title status priority")
    };
  }

  /**
   * Remove a dependency from a task
   */
  async removeDependency(taskId: string, dependencyTaskId: string, userId: string) {
    // Verify both tasks exist
    const [task, dependencyTask] = await Promise.all([
      Task.findOne({ _id: taskId, isDeleted: false }),
      Task.findOne({ _id: dependencyTaskId, isDeleted: false })
    ]);

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    if (!dependencyTask) {
      throw new AppError("Dependency task not found", 404);
    }

    // Verify user has access
    const workspace = await Workspace.findOne({
      _id: task.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this task", 403);
    }

    // Remove dependency
    task.dependencies = task.dependencies.filter(
      (dep: any) => dep.toString() !== dependencyTaskId
    );
    dependencyTask.dependents = dependencyTask.dependents.filter(
      (dep: any) => dep.toString() !== taskId
    );

    await Promise.all([task.save(), dependencyTask.save()]);

    // Log activity
    await logger.logActivity({
      userId,
      workspaceId: task.workspace.toString(),
      action: "REMOVE_DEPENDENCY",
      resourceType: "Task",
      resourceId: task._id.toString(),
      metadata: {
        dependencyTaskId,
        dependencyTaskTitle: dependencyTask.title
      }
    });

    // Emit real-time events
    try {
      emitTaskEvent(
        taskId,
        "dependency_removed",
        {
          task: {
            _id: task._id,
            title: task.title
          },
          dependencyTaskId
        },
        userId
      );

      emitTaskEvent(
        dependencyTaskId,
        "dependent_removed",
        {
          task: {
            _id: dependencyTask._id,
            title: dependencyTask.title
          },
          dependentTaskId: taskId
        },
        userId
      );
    } catch (error) {
      console.error("Failed to emit dependency removal events:", error);
    }

    return { message: "Dependency removed successfully" };
  }

  /**
   * Get task dependencies (tasks that this task depends on)
   */
  async getDependencies(taskId: string, userId: string) {
    const task = await Task.findOne({
      _id: taskId,
      isDeleted: false
    }).populate("dependencies", "title status priority dueDate assignee");

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    // Verify user has access
    const workspace = await Workspace.findOne({
      _id: task.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this task", 403);
    }

    return task.dependencies;
  }

  /**
   * Get task dependents (tasks that depend on this task)
   */
  async getDependents(taskId: string, userId: string) {
    const task = await Task.findOne({
      _id: taskId,
      isDeleted: false
    }).populate("dependents", "title status priority dueDate assignee");

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    // Verify user has access
    const workspace = await Workspace.findOne({
      _id: task.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this task", 403);
    }

    return task.dependents;
  }

  /**
   * Check for circular dependencies using DFS
   */
  private async checkCircularDependency(
    startTaskId: string,
    targetTaskId: string,
    visited: Set<string> = new Set()
  ): Promise<boolean> {
    // If we've reached the target, we have a cycle
    if (startTaskId === targetTaskId) {
      return true;
    }

    // If already visited, skip
    if (visited.has(startTaskId)) {
      return false;
    }

    visited.add(startTaskId);

    // Get the task's dependencies
    const task = await Task.findOne({
      _id: startTaskId,
      isDeleted: false
    }).select("dependencies");

    if (!task || !task.dependencies || task.dependencies.length === 0) {
      return false;
    }

    // Check each dependency recursively
    for (const depId of task.dependencies) {
      const hasCircular = await this.checkCircularDependency(
        depId.toString(),
        targetTaskId,
        visited
      );
      if (hasCircular) {
        return true;
      }
    }

    return false;
  }

  /**
   * Override updateTask to notify dependents when status changes
   */
  async updateTaskWithDependencyNotification(
    taskId: string,
    userId: string,
    updateData: UpdateTaskData
  ) {
    const result = await this.updateTask(taskId, userId, updateData);

    // If status changed, notify all dependent tasks' assignees
    if (updateData.status) {
      const task = await Task.findById(taskId)
        .populate("dependents")
        .populate("assignee", "name email");

      if (task && task.dependents && task.dependents.length > 0) {
        for (const dependent of task.dependents) {
          const depTask: any = dependent;
          if (depTask.assignee && depTask.assignee.toString() !== userId) {
            enhancedNotificationService.notifyDependencyStatusChanged(
              depTask._id.toString(),
              taskId,
              userId,
              updateData.status
            ).catch((error: any) => {
              console.error("Failed to send dependency status notification:", error);
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * Track field changes and create activity records
   * Only tracks important fields that warrant notifications
   */
  private async trackFieldChanges(
    taskId: string,
    userId: string,
    workspaceId: string,
    oldValues: any,
    newValues: any
  ) {
    const activityService = require("./activityService");
    
    // Fields to track
    const trackedFields = [
      { field: "status", label: "Status" },
      { field: "assignee", label: "Assignee" },
      { field: "priority", label: "Priority" },
      { field: "dueDate", label: "Due Date" },
      { field: "startDate", label: "Start Date" },
      { field: "title", label: "Title" },
    ];

    for (const { field } of trackedFields) {
      const oldValue = oldValues[field];
      const newValue = newValues[field];

      // Check if field actually changed
      const hasChanged = this.hasFieldChanged(oldValue, newValue, field);

      if (hasChanged) {
        try {
          await activityService.createUpdate({
            taskId,
            userId,
            fieldChanged: field,
            oldValue: this.formatFieldValue(oldValue, field),
            newValue: this.formatFieldValue(newValue, field),
            isSystemGenerated: false,
          });

          console.log(`[Activity] Tracked ${field} change for task ${taskId}`);
        } catch (error) {
          console.error(`[Activity] Failed to track ${field} change:`, error);
          // Don't fail the task update if activity tracking fails
        }
      }
    }
  }

  /**
   * Check if a field has actually changed
   */
  private hasFieldChanged(oldValue: any, newValue: any, field: string): boolean {
    // Handle ObjectId comparisons
    if (field === "assignee") {
      const oldId = oldValue?._id?.toString() || oldValue?.toString();
      const newId = newValue?._id?.toString() || newValue?.toString();
      return oldId !== newId;
    }

    // Handle date comparisons
    if (field === "dueDate" || field === "startDate") {
      const oldDate = oldValue ? new Date(oldValue).getTime() : null;
      const newDate = newValue ? new Date(newValue).getTime() : null;
      return oldDate !== newDate;
    }

    // Handle primitive comparisons
    return oldValue !== newValue;
  }

  /**
   * Format field value for activity display
   */
  private formatFieldValue(value: any, field: string): any {
    if (value === null || value === undefined) {
      return null;
    }

    // Handle assignee (ObjectId or populated object)
    if (field === "assignee") {
      if (typeof value === "object" && value.name) {
        return {
          id: value._id?.toString() || value.toString(),
          name: value.name,
          email: value.email,
        };
      }
      return value.toString();
    }

    // Handle dates
    if (field === "dueDate" || field === "startDate") {
      return new Date(value).toISOString();
    }

    // Return as-is for other fields
    return value;
  }
}

module.exports = new TaskService();

export {};
