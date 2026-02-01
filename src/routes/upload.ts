import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

// 确保上传目录存在
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // 使用时间戳 + 原始文件名避免冲突
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  },
});

// 文件过滤器
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // 允许的文件类型
  const allowedMimes = [
    // 文本文件
    "text/plain",
    "text/markdown",
    "text/html",
    "text/css",
    "text/javascript",
    "application/json",
    "application/xml",
    // 代码文件
    "application/javascript",
    "application/typescript",
    "application/x-python",
    "application/x-python-code",
    // 图片
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    // 文档
    "application/pdf",
    // 其他
    "application/octet-stream", // 未知类型，根据扩展名判断
  ];

  // 允许的文件扩展名
  const allowedExts = [
    ".txt",
    ".md",
    ".json",
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".py",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".go",
    ".rs",
    ".rb",
    ".php",
    ".html",
    ".css",
    ".scss",
    ".yaml",
    ".yml",
    ".xml",
    ".sql",
    ".sh",
    ".bash",
    ".zsh",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".pdf",
    ".log",
    ".csv",
  ];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype} (${ext})`));
  }
};

// 配置上传中间件
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 限制
    files: 5, // 最多 5 个文件
  },
});

/**
 * POST /api/upload
 * 上传单个或多个文件
 */
router.post(
  "/",
  upload.array("files", 5),
  (req: Request, res: Response): void => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: "没有上传文件",
        });
        return;
      }

      const uploadedFiles = files.map((file) => ({
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
      }));

      console.log(`📤 上传了 ${files.length} 个文件:`, uploadedFiles.map((f) => f.originalName));

      res.json({
        success: true,
        files: uploadedFiles,
      });
    } catch (error) {
      console.error("上传错误:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "上传失败",
      });
    }
  }
);

/**
 * DELETE /api/upload/:filename
 * 删除已上传的文件
 */
router.delete("/:filename", (req: Request, res: Response): void => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadDir, filename);

    // 安全检查：确保文件在上传目录内
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(uploadDir))) {
      res.status(403).json({
        success: false,
        error: "无权访问该文件",
      });
      return;
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ 删除文件: ${filename}`);
      res.json({ success: true });
    } else {
      res.status(404).json({
        success: false,
        error: "文件不存在",
      });
    }
  } catch (error) {
    console.error("删除文件错误:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    });
  }
});

/**
 * GET /api/upload/list
 * 列出所有已上传的文件
 */
router.get("/list", (_req: Request, res: Response): void => {
  try {
    const files = fs.readdirSync(uploadDir).map((filename) => {
      const filePath = path.join(uploadDir, filename);
      const stats = fs.statSync(filePath);
      return {
        filename,
        path: filePath,
        size: stats.size,
        createdAt: stats.birthtime,
      };
    });

    res.json({
      success: true,
      files,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "获取文件列表失败",
    });
  }
});

export default router;
