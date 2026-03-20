# ==========================================
# 阶段一：前端构建 (Builder)
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# 复制前端描述文件并安装依赖
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# 复制前端源代码并打包
COPY frontend/ ./
RUN npm run build

# ==========================================
# 阶段二：后端运行环境 (Runtime)
# ==========================================
FROM python:3.11-slim
WORKDIR /app

# 安装 OpenCV 依赖的底层 C++ 动态链接库
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

# 复制后端依赖清单并安装
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# 复制后端所有源代码
COPY backend/ ./backend/

# 💎 核心：将阶段一打包好的前端静态文件，精准复制到后端目录中
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 声明对外暴露的端口
EXPOSE 8000

# 容器启动时默认执行的命令
CMD ["python", "backend/server.py"]