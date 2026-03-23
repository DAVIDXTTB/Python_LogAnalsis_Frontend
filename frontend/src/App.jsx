import React, { useState, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  Cpu, Calendar, Settings, Activity, Clock, Target, Download, RefreshCw, X
} from 'lucide-react';

const App = () => {
  const [datesList, setDatesList] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('等待连接 API...');
  
  const [uiData, setUiData] = useState({
      error: [], warning: [], normal: [], ignore: [], 
      pies: { primary: [], secondary: [], pallet: [], total: [] },
      kpi: { total: 0, exceptions: 0 }
  });

  const [config, setConfig] = useState({ log_root: '', nesting_root: '' });
  const [showConfig, setShowConfig] = useState(false);

  const [selectedPart, setSelectedPart] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchDates();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig(data);
    } catch (e) { console.error("API 未连接"); }
  };

  const fetchDates = async () => {
    try {
      const res = await fetch('/api/dates');
      const data = await res.json();
      setDatesList(data);
      if (data.length > 0) {
        setSelectedDate(data[0]);
      } else {
        setStatusMsg("✅ 后端已连接！请点击左下角配置路径。");
      }
    } catch (e) { setStatusMsg("⚠️ 无法连接到 Python 后端"); }
  };

  const saveConfig = async () => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      setShowConfig(false);
      fetchDates();
    } catch (e) { alert("保存配置失败，请确保后端已启动。"); }
  };

  const fetchDailyData = async (dateStr, forceRefresh = false) => {
    if (!dateStr) return;
    setIsLoading(true);
    setStatusMsg(forceRefresh ? `🔄 强制让后端重新解析 ${dateStr} 日志...` : `🚀 正在获取 ${dateStr} 数据...`);
    
    try {
      const response = await fetch(`/api/analyze?date_folder=${dateStr}&refresh=${forceRefresh}`);
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setUiData(data);
      setStatusMsg(`✅ ${dateStr} 数据已就绪，共处理 ${data.kpi.total} 件`);
    } catch (error) {
      console.error(error);
      setStatusMsg(`❌ 分析失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDate) fetchDailyData(selectedDate, false);
  }, [selectedDate]);

  const handleExport = async () => {
    if (!selectedDate) return;
    setIsLoading(true);
    setStatusMsg("📦 正在由后端 OpenCV 引擎打包带图 Excel，请稍候...");
    try {
      const response = await fetch(`/api/export?date_folder=${selectedDate}`);
      if (!response.ok) throw new Error("导出失败");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `产线数字孪生报表_${selectedDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      setStatusMsg("✅ Excel 报表已成功下载至本地！");
    } catch (error) {
      setStatusMsg("❌ 报表下载失败，请检查后端运行状态。");
    } finally {
      setIsLoading(false);
    }
  };

  const renderPartItem = (item, colorClass) => (
    <div 
      key={item.uid} 
      onClick={() => { setSelectedPart(item); setIsModalOpen(true); }}
      className="cursor-pointer flex justify-between items-center p-3 mb-3 bg-[#1e293b] border border-[#334155] rounded-xl hover:bg-[#334155] transition-colors"
    >
      <div className="flex-1">
        <div className={`font-bold text-sm ${colorClass}`}>{item.part_no}</div>
        <div className="text-xs text-slate-400 font-mono mt-1">UID: {item.uid}</div>
        <div className="text-xs text-slate-500 mt-1 flex items-center">
            <Clock size={12} className="mr-1"/> {item.duration}m | {item.status}
        </div>
      </div>
      <div className="w-20 h-20 bg-[#020617] rounded-lg flex items-center justify-center border border-[#0f172a] ml-2 overflow-hidden shrink-0 shadow-inner">
        {item.img_url ? (
            <img src={item.img_url} alt="CAD" className="max-w-full max-h-full object-contain" />
        ) : (
            <span className="text-[10px] text-slate-600">无图形</span>
        )}
      </div>
    </div>
  );

  // 🌟 通用的饼图渲染函数
  const COLORS = { '🟢 正常': '#22c55e', '🟡 警戒': '#f59e0b', '🔴 异常': '#ef4444' };
  const renderPie = (data, title) => (
      <div className="flex flex-col items-center justify-center h-48 bg-[#020617] rounded-lg border border-[#1e293b] p-2 relative shadow-inner">
          <h4 className="text-[10px] text-slate-400 font-bold mb-1 absolute top-2 left-3 tracking-widest">{title}</h4>
          {data && data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                      <Pie data={data} innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value">
                          {data.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[entry.name]} stroke="rgba(0,0,0,0)" />
                          ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#fff' }} />
                      <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{fontSize: '10px'}}/>
                  </PieChart>
              </ResponsiveContainer>
          ) : (
              <div className="text-xs text-slate-600 font-mono flex-1 flex items-center justify-center">无数据 / 彻底剔除</div>
          )}
      </div>
  );

  return (
    <div className="flex w-screen h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      <aside className="w-72 bg-[#0b1120] border-r border-[#1e293b] flex flex-col z-20 shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
        <div className="h-20 flex items-center px-6 border-b border-[#1e293b] bg-[#0f172a]">
          <Cpu className="text-blue-500 mr-3 shrink-0" size={28} />
          <div>
            <h1 className="text-base font-black tracking-wider text-slate-100" style={{ fontSize: '85%' }}>华工小筑，数字看板</h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Web API Edition</p>
          </div>
        </div>

        <div className="flex-1 py-6 overflow-y-auto custom-scrollbar">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 px-6 flex items-center">
            <Calendar size={14} className="mr-2" /> 历史批次
          </h2>
          <div className="space-y-2 px-4">
            {datesList.length > 0 ? datesList.map(date => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                disabled={isLoading}
                className={`appearance-none outline-none w-full flex items-center text-left px-4 py-3 rounded-lg text-sm transition-all border
                  ${selectedDate === date 
                    ? 'border-blue-500 bg-[#1e40af]/30 text-blue-400 font-bold shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                    : 'border-transparent bg-[#1e293b] text-slate-400 hover:bg-[#334155] hover:text-slate-200'}`}
              >
                <span className="font-medium font-mono">{date}</span>
              </button>
            )) : (
              <div className="text-xs text-slate-600 text-center py-4 bg-[#0f172a] rounded mx-2 border border-[#1e293b] border-dashed">无批次数据</div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[#1e293b] bg-[#0f172a]">
          <button 
            onClick={() => setShowConfig(!showConfig)} 
            className="appearance-none outline-none w-full flex items-center justify-center px-4 py-3 rounded-lg text-sm font-bold bg-[#1e293b] border border-[#334155] text-slate-300 hover:bg-[#334155] hover:text-white transition-colors"
          >
            <Settings size={16} className="mr-2" /> 引擎配置中心
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#020617]">
        {showConfig && (
            <div className="absolute top-0 left-0 w-full bg-[#0f172a]/95 backdrop-blur-md border-b border-[#1e293b] p-8 z-50 shadow-2xl">
                <h3 className="text-lg font-bold mb-6 flex items-center text-slate-100"><Settings className="mr-2 text-blue-400"/> Python 后端路径映射配置</h3>
                <div className="space-y-5 max-w-3xl">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Log 根目录绝对路径</label>
                        <input type="text" value={config.log_root} onChange={e => setConfig({...config, log_root: e.target.value})} className="appearance-none w-full bg-[#020617] border border-[#334155] rounded-lg p-3 text-sm text-slate-300 focus:outline-none focus:border-blue-500 transition-colors" placeholder="例如: /Volumes/uuu/60上logtest" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">套料图物理库路径 (VISUALNESTING)</label>
                        <input type="text" value={config.nesting_root} onChange={e => setConfig({...config, nesting_root: e.target.value})} className="appearance-none w-full bg-[#020617] border border-[#334155] rounded-lg p-3 text-sm text-slate-300 focus:outline-none focus:border-blue-500 transition-colors" placeholder="例如: /Volumes/uuu/60上logtest/VISUALNESTING" />
                    </div>
                    <div className="flex gap-4 pt-4">
                        <button onClick={saveConfig} className="appearance-none outline-none bg-blue-600 hover:bg-blue-500 px-8 py-2.5 rounded-lg text-sm font-bold text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all">💾 保存并通知引擎</button>
                        <button onClick={() => setShowConfig(false)} className="appearance-none outline-none bg-[#1e293b] hover:bg-[#334155] border border-[#334155] px-8 py-2.5 rounded-lg text-sm text-slate-300 transition-all">取消</button>
                    </div>
                </div>
            </div>
        )}

        <header className="h-20 px-8 flex items-center justify-between border-b border-[#1e293b] bg-[#0b1120] shrink-0">
          <div className="flex items-center">
            <div className="w-2 h-8 bg-blue-500 mr-4 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
            <div>
              <h2 className="text-xl font-black text-slate-100 flex items-center">
                批次分析大屏 {selectedDate && <span className="text-blue-400 ml-2">- {selectedDate}</span>}
                {isLoading && <div className="ml-3 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-mono">{statusMsg}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
                onClick={() => fetchDailyData(selectedDate, true)} 
                disabled={!selectedDate || isLoading}
                className={`appearance-none outline-none flex items-center px-4 py-2.5 rounded-lg text-sm font-bold transition-all border
                    ${(!selectedDate || isLoading) 
                        ? 'bg-[#1e293b] text-slate-500 border-transparent cursor-not-allowed' 
                        : 'bg-[#0f172a] hover:bg-[#1e293b] text-slate-300 border-[#334155] hover:text-white'}`}
            >
                <RefreshCw size={16} className="mr-2" />
                获取最新实况
            </button>
            
            <button 
                onClick={handleExport} 
                disabled={!selectedDate || isLoading}
                className={`appearance-none outline-none flex items-center px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg
                    ${(!selectedDate || isLoading) 
                        ? 'bg-[#1e293b] text-slate-500 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]'}`}
            >
                <Download size={16} className="mr-2" />
                下载可视化报表
            </button>
          </div>
        </header>

        <div className={`flex-1 overflow-hidden flex transition-opacity duration-300 ${isLoading ? 'opacity-30' : 'opacity-100'}`}>
            <div className="w-[420px] border-r border-[#1e293b] flex flex-col bg-[#0b1120]">
                <div className="p-5 border-b border-[#1e293b] bg-[#0f172a]">
                    <h3 className="font-bold text-sm text-slate-200 flex items-center tracking-wide">
                        <Target size={16} className="mr-2 text-blue-500" /> 实体映射清单 (OpenCV)
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                    {uiData.error.map(item => renderPartItem(item, 'text-red-500'))}
                    {uiData.warning.map(item => renderPartItem(item, 'text-yellow-500'))}
                    {uiData.normal.map(item => renderPartItem(item, 'text-green-500'))}
                </div>
            </div>

            <div className="flex-1 p-8 flex flex-col bg-[#020617]">
               <div className="grid grid-cols-2 gap-8 mb-8 shrink-0">
                  <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-6 relative overflow-hidden shadow-lg">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-bl-full -mr-4 -mt-4"></div>
                    <p className="text-sm text-slate-400 font-medium mb-2 uppercase tracking-wider">处理总零件数</p>
                    <h3 className="text-4xl font-black text-slate-100 font-mono">{uiData.kpi.total}</h3>
                  </div>
                  <div className={`bg-[#0f172a] border rounded-xl p-6 relative overflow-hidden shadow-lg transition-colors ${uiData.kpi.exceptions > 0 ? 'border-red-900/50 bg-red-950/20' : 'border-[#1e293b]'}`}>
                    <p className="text-sm text-slate-400 font-medium mb-2 uppercase tracking-wider">异常拦截数</p>
                    <h3 className={`text-4xl font-black font-mono ${uiData.kpi.exceptions > 0 ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'text-slate-100'}`}>{uiData.kpi.exceptions}</h3>
                  </div>
               </div>

               <div className="flex-1 bg-[#0f172a] border border-[#1e293b] rounded-xl p-6 flex flex-col overflow-hidden shadow-lg">
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-6 flex items-center shrink-0">
                    <Activity size={16} className="mr-2 text-green-500" /> 全局耗时分布矩阵 (Min)
                  </h3>
                  
                  {/* 🌟 替换区：从原本的单一 BarChart 替换为 4列的 Grid */}
                  <div className="flex-1 grid grid-cols-4 gap-4 px-2 items-center">
                      {renderPie(uiData.pies?.primary, "① 一次分拣")}
                      {renderPie(uiData.pies?.secondary, "② 二次分拣")}
                      {renderPie(uiData.pies?.pallet, "③ 码盘调度")}
                      {renderPie(uiData.pies?.total, "◎ 总体进度 (P90)")}
                  </div>
               </div>
            </div>
        </div>
        
        {isModalOpen && selectedPart && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#020617]/80 backdrop-blur-sm">
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-[500px] max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              
              <div className="flex items-center justify-between p-5 border-b border-[#1e293b] bg-[#0b1120]">
                <div>
                  <h3 className="text-lg font-black text-slate-100">{selectedPart.part_no}</h3>
                  <p className="text-xs text-slate-400 font-mono mt-1">UID: {selectedPart.uid} | 耗时: {selectedPart.duration}m</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 bg-[#1e293b] rounded-lg text-slate-400 hover:text-white hover:bg-red-500/80 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-[#020617]">
                {selectedPart.history && selectedPart.history.length > 0 ? (
                  <div className="relative border-l border-[#334155] ml-3 space-y-6">
                    {selectedPart.history.map((log, idx) => {
                      const match = log.match(/\[(.*?)\] (.*)/);
                      const time = match ? match[1] : '';
                      const action = match ? match[2] : log;
                      const isError = action.includes('异常') || action.includes('超时');

                      return (
                        <div key={idx} className="relative pl-6">
                          <div className={`absolute -left-1.5 top-1 w-3 h-3 rounded-full border-2 border-[#020617] ${isError ? 'bg-red-500' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]'}`}></div>
                          <div className={`text-sm font-bold ${isError ? 'text-red-400' : 'text-slate-200'}`}>{action}</div>
                          <div className="text-xs text-slate-500 font-mono mt-1">{time}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-10 text-sm">暂无流程记录数据</div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;