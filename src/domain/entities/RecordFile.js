export class RecordFile {
  constructor({
    id,
    recordId,
    fileUrl,
    fileType,
    createdAt,
    isCover,
    focusX,
    focusY,
    focusScale,
  }) {
    this.id = id;
    this.recordId = recordId;
    this.fileUrl = fileUrl;
    this.fileType = fileType;
    this.createdAt = createdAt;
    this.isCover = isCover;
    this.focusX = focusX;
    this.focusY = focusY;
    this.focusScale = focusScale;
  }

  toPublic() {
    return {
      id: this.id,
      record_id: this.recordId,
      file_url: this.fileUrl,
      file_type: this.fileType,
      created_at: this.createdAt,
      is_cover: this.isCover,
      focus_x: this.focusX,
      focus_y: this.focusY,
      focus_scale: this.focusScale,
    };
  }
}
