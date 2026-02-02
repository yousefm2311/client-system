import { Schema, model, models } from "mongoose";

const UploadFileRecordSchema = new Schema(
  {
    localFileId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    clientId: {
      type: String,
      required: true,
      index: true,
    },
    originalName: {
      type: String,
    },
    size: {
      type: Number,
    },
    mime: {
      type: String,
    },
    status: {
      type: String,
      enum: ["uploading", "done", "failed"],
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    storagePath: {
      type: String,
    },
    lastError: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: "UploadFileRecord" }
);

UploadFileRecordSchema.index({ clientId: 1, createdAt: -1 });

export const UploadFileRecordModel =
  models.UploadFileRecord || model("UploadFileRecord", UploadFileRecordSchema);
