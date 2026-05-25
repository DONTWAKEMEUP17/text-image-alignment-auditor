# Alignment Auditor

一个用于分析和审计图像生成模型对齐性的项目。包含FastAPI后端和React前端。

## 项目结构

```
├── server/              # Python FastAPI后端
│   ├── server.py        # 主服务器文件
│   └── alignment_auditor.duckdb  # DuckDB数据库
├── client/              # React前端
│   ├── src/
│   │   ├── App.jsx
│   │   ├── Charts.jsx
│   │   ├── Gallery.jsx
│   │   └── ...
│   └── package.json
└── images/              # 图片资源
```

## 安装与运行

### 后端部分

1. 安装依赖：
```bash
pip install -r requirements.txt
```

2. 运行服务器：
```bash
cd server
uvicorn server:app --reload --port 8000
```

API 文档访问：http://localhost:8000/docs

### 前端部分

1. 安装依赖：
```bash
cd client
npm install
```

2. 开发模式运行：
```bash
npm run dev
```

3. 生产构建：
```bash
npm run build
```

## API 文档

启动后端服务后，访问 http://localhost:8000/docs 可查看完整的API文档。

## 环境变量

在运行后端时可以配置以下环境变量：

- `DB_PATH` - DuckDB数据库路径（默认：`./alignment_auditor.duckdb`）
- `IMG_DIR_SD` - SD 1.5 图片目录（默认：`../images/sd1x_images`）
- `IMG_DIR_FLUX` - FLUX 图片目录（默认：`../images/flux_images_paired`）
