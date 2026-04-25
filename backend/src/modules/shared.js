const mongoose = require("mongoose");

const tenantScopedFields = {
  tenantId: { type: String, required: true, index: true },
  createdBy: { type: String },
  updatedBy: { type: String },
  deletedAt: { type: Date, default: null },
  auditLog: [
    {
      action: String,
      at: { type: Date, default: Date.now },
      by: String,
      note: String,
    },
  ],
};

const makeEntityModel = (name, extraFields = {}) => {
  const schema = new mongoose.Schema(
    {
      ...tenantScopedFields,
      name: { type: String, required: true, trim: true },
      status: { type: String, default: "active" },
      ...extraFields,
    },
    { timestamps: true }
  );
  return mongoose.models[name] || mongoose.model(name, schema);
};

const buildCrudRouter = ({ model, entity, postCreate }) => {
  const express = require("express");
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      const docs = await model.find({ tenantId: req.tenantId, deletedAt: null }).sort({ createdAt: -1 });
      res.json(docs);
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const payload = {
        ...req.body,
        tenantId: req.tenantId,
        createdBy: req.user?.id,
        updatedBy: req.user?.id,
        auditLog: [{ action: `${entity}.create`, by: req.user?.id, note: "Created record" }],
      };
      const doc = await model.create(payload);
      if (postCreate) {
        await postCreate({ doc, req });
      }
      res.status(201).json(doc);
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const doc = await model.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.tenantId, deletedAt: null },
        {
          ...req.body,
          updatedBy: req.user?.id,
          $push: { auditLog: { action: `${entity}.update`, by: req.user?.id, note: "Updated record" } },
        },
        { new: true }
      );
      res.json(doc);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const doc = await model.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.tenantId, deletedAt: null },
        {
          deletedAt: new Date(),
          updatedBy: req.user?.id,
          $push: { auditLog: { action: `${entity}.delete`, by: req.user?.id, note: "Soft deleted record" } },
        },
        { new: true }
      );
      res.json({ message: "Deleted", doc });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

module.exports = { makeEntityModel, buildCrudRouter };
