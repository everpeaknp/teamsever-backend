"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asyncHandler = require("../utils/asyncHandler");
const listService = require("../services/listService");
const AppError = require("../utils/AppError");
// @desc    Create new list
// @route   POST /api/spaces/:spaceId/lists
// @access  Private
const createList = asyncHandler(async (req, res, next) => {
    const { name, folderId } = req.body;
    const { spaceId } = req.params;
    const list = await listService.createList({
        name,
        space: spaceId,
        createdBy: req.user.id,
        folderId: folderId || undefined
    });
    res.status(201).json({
        success: true,
        data: list
    });
});
// @desc    Get all lists in space
// @route   GET /api/spaces/:spaceId/lists
// @access  Private
const getSpaceLists = asyncHandler(async (req, res, next) => {
    const { spaceId } = req.params;
    const lists = await listService.getSpaceLists(spaceId, req.user.id);
    res.status(200).json({
        success: true,
        count: lists.length,
        data: lists
    });
});
// @desc    Get single list
// @route   GET /api/lists/:id
// @access  Private
const getList = asyncHandler(async (req, res, next) => {
    const list = await listService.getListById(req.params.id, req.user.id);
    res.status(200).json({
        success: true,
        data: list
    });
});
// @desc    Update list
// @route   PATCH /api/lists/:id
// @access  Private
const updateList = asyncHandler(async (req, res, next) => {
    const { name } = req.body;
    const list = await listService.updateList(req.params.id, req.user.id, { name });
    res.status(200).json({
        success: true,
        data: list
    });
});
// @desc    Delete list
// @route   DELETE /api/lists/:id
// @access  Private
const deleteList = asyncHandler(async (req, res, next) => {
    const result = await listService.deleteList(req.params.id, req.user.id);
    res.status(200).json({
        success: true,
        data: result
    });
});
module.exports = {
    createList,
    getSpaceLists,
    getList,
    updateList,
    deleteList
};
