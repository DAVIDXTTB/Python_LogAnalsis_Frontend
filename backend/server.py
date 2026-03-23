import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
import uvicorn
from core import LogCore

app = FastAPI(title="Digital Twin API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = LogCore()
memory_cache = {}

@app.get("/thumbs/{date_folder}/{filename}")
def get_thumbnail(date_folder: str, filename: str):
    if not engine.log_root:
        raise HTTPException(status_code=400, detail="Log 根目录未配置")
        
    file_path = os.path.join(engine.log_root, date_folder, ".ui_thumbs_cache", filename)
    
    if os.path.exists(file_path):
        return FileResponse(file_path)
    else:
        raise HTTPException(status_code=404, detail="图片未找到")

@app.get("/api/config")
def get_config():
    return {"log_root": engine.log_root, "nesting_root": engine.nesting_root}

@app.post("/api/config")
def update_config(config: dict):
    engine.save_config(config.get('log_root'), config.get('nesting_root'))
    return {"status": "success", "msg": "配置已保存，图库索引已重建"}

@app.get("/api/dates")
def get_dates():
    if not engine.log_root or not os.path.exists(engine.log_root):
        return []
    folders = [f for f in os.listdir(engine.log_root) 
               if os.path.isdir(os.path.join(engine.log_root, f)) and f not in ['VISUALNESTING', 'charts', '.ui_thumbs_cache']]
    folders.sort(reverse=True)
    return folders

@app.get("/api/analyze")
def analyze_data(date_folder: str, refresh: bool = False):
    if not engine.log_root:
        raise HTTPException(status_code=400, detail="未配置 Log 根目录")
        
    if not refresh and date_folder in memory_cache:
        return memory_cache[date_folder]
        
    folder_path = os.path.join(engine.log_root, date_folder)
    df, msg = engine.process_folder(folder_path)
    
    if df is None:
        raise HTTPException(status_code=500, detail=msg)
    
    records = df.to_dict('records')
    
    ui_data = {
        'error': [], 'warning': [], 'normal': [], 'ignore': [],
        'kpi': {'total': len(records), 'exceptions': 0},
        'pies': {}
    }

    pies_counts = {
        'primary': {'正常': 0, '警戒': 0, '异常': 0},
        'secondary': {'正常': 0, '警戒': 0, '异常': 0},
        'truss': {'正常': 0, '警戒': 0, '异常': 0},
        'pallet': {'正常': 0, '警戒': 0, '异常': 0},
        'total': {'正常': 0, '警戒': 0, '异常': 0}
    }

    def categorize(dur, limit_normal=1.0, limit_warn=30.0):
        if dur < 0: return None
        if dur <= limit_normal: return '正常'
        elif dur <= limit_warn: return '警戒'
        else: return '异常'
    
    for row in records:
        uid = row.get('唯一编号 (Unique ID)', '')
        part_no = row.get('零件号 (Part Code)', '')
        status = row.get('状态', '')
        duration = row.get('总耗时(分钟)', 0)
        
        img_url = f"/thumbs/{date_folder}/{uid}.png" if row.get('UI微缩图') else None
        
        history_raw = row.get('完整流程追踪', '')
        history_list = history_raw.split('\n') if history_raw else []
        
        # 🌟 修改：提前执行分类函数
        cat_pri = categorize(row.get('一次分拣耗时', -1.0))
        cat_sec = categorize(row.get('二次分拣耗时', -1.0))
        cat_truss = categorize(row.get('桁架分拣耗时', -1.0), limit_normal=15.0, limit_warn=40.0)
        cat_pal = categorize(row.get('码盘调度耗时', -1.0))

        total_cat = '正常'
        if '🔴' in status: total_cat = '异常'
        elif '🟡' in status: total_cat = '警戒'
        
        # 🌟 修改：将步骤详情打入 item 数据节点
        item = {
            'uid': uid, 'part_no': part_no, 'status': status, 'duration': duration, 
            'img_url': img_url, 'history': history_list,
            'steps': {
                'primary': cat_pri,
                'secondary': cat_sec,
                'truss': cat_truss,
                'pallet': cat_pal,
                'total': total_cat
            }
        }
        
        if cat_pri: pies_counts['primary'][cat_pri] += 1
        if cat_sec: pies_counts['secondary'][cat_sec] += 1
        if cat_truss: pies_counts['truss'][cat_truss] += 1
        if cat_pal: pies_counts['pallet'][cat_pal] += 1
        pies_counts['total'][total_cat] += 1

        if '🔴' in status: 
            ui_data['error'].append(item)
            ui_data['kpi']['exceptions'] += 1
        elif '🟡' in status: ui_data['warning'].append(item)
        elif '🟢' in status: ui_data['normal'].append(item)
        else: ui_data['ignore'].append(item)
        
    def format_pie(d): return [{'name': k, 'value': v} for k, v in d.items() if v > 0]
    
    ui_data['pies'] = {
        'primary': format_pie(pies_counts['primary']),
        'secondary': format_pie(pies_counts['secondary']),
        'truss': format_pie(pies_counts['truss']),
        'pallet': format_pie(pies_counts['pallet']),
        'total': format_pie(pies_counts['total'])
    }
    
    memory_cache[date_folder] = ui_data 
    return ui_data

@app.get("/api/export")
def export_excel(date_folder: str):
    if not engine.log_root:
        raise HTTPException(status_code=400, detail="未配置 Log 根目录")
        
    folder_path = os.path.join(engine.log_root, date_folder)
    df, msg = engine.process_folder(folder_path)
    
    if df is None:
        raise HTTPException(status_code=500, detail=msg)
        
    export_path = os.path.join(folder_path, f"Report_{date_folder}.xlsx")
    success = engine.export_excel_with_images(df, export_path)
    
    if success and os.path.exists(export_path):
        return FileResponse(
            path=export_path, 
            filename=f"产线数字孪生报表_{date_folder}.xlsx", 
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    else:
        raise HTTPException(status_code=500, detail="Excel 生成失败")

frontend_dist = os.path.join(os.path.dirname(__file__), "../frontend/dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
else:
    print("ℹ️ 提示: 本地开发模式运行中。如需部署，请先执行 npm run build。")

if __name__ == "__main__":
    print("🚀 启动孪生看板 API 服务... 端口: 8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)