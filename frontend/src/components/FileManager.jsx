import React, { useState } from 'react';

const FileManager = ({ projectId, onBack }) => {
    // TODO: Fetch files from API
    const [currentFolder, setCurrentFolder] = useState(null);

    // Placeholder folders
    const folders = [
        { name: 'Проджекти', icon: 'fa-project-diagram', color: 'text-slate-400' },
        { name: 'Перекупні позиції', icon: 'fa-shopping-cart', color: 'text-slate-400' },
        { name: 'Метал', icon: 'fa-hammer', color: 'text-slate-400' },
        { name: 'Креслення', icon: 'fa-print', color: 'text-blue-600', active: true },
        { name: 'Погодження', icon: 'fa-file-signature', color: 'text-slate-400' },
        { name: 'Фурнітура', icon: 'fa-boxes', color: 'text-slate-400' }
    ];

    // Placeholder files for demo
    const files = [
        { name: "Специфікація_Корпуси_V2.pdf", date: "14.03.2025", size: "4.2 MB", type: "PDF" }
    ];

    if (currentFolder) {
        return (
            <div id="folder-page">
                <button onClick={() => setCurrentFolder(null)} className="mb-6 text-slate-400 hover:text-blue-600 font-bold text-xs uppercase transition">
                    <i className="fas fa-arrow-left mr-2"></i> Назад до папок
                </button>

                <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                    <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <i className="fas fa-folder-open text-2xl"></i>
                            <h2 className="text-xl font-extrabold uppercase italic tracking-widest">{currentFolder}</h2>
                        </div>
                        <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition italic">
                            Завантажити все .ZIP
                        </button>
                    </div>

                    {/* Upload Area (Visual Only for now) */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 text-center py-8 border-dashed border-2 border-slate-200 m-4 rounded-2xl cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition">
                        <p className="text-slate-400 text-xs font-bold uppercase">Натисніть або перетягніть файли сюди</p>
                    </div>

                    <div className="p-4 space-y-2">
                        {files.map((file, idx) => (
                            <div key={idx} className="flex justify-between items-center p-4 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition group">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center font-black text-xs">{file.type}</div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">{file.name}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase italic">Завантажено: {file.date} • {file.size}</p>
                                    </div>
                                </div>
                                <a href="#" className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition">
                                    <i className="fas fa-download"></i>
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 italic">
                <i className="fas fa-folders mr-2"></i> Виберіть папку для роботи з файлами
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {folders.map((folder) => (
                    <button
                        key={folder.name}
                        onClick={() => setCurrentFolder(folder.name)}
                        className={`folder-btn p-6 rounded-3xl flex flex-col items-center gap-3 ${folder.active ? 'bg-blue-50 border-solid border-blue-500' : ''}`}
                    >
                        <i className={`fas ${folder.icon} text-2xl ${folder.active ? 'text-blue-600' : 'text-slate-400'}`}></i>
                        <span className={`text-[10px] font-bold uppercase italic text-center ${folder.active ? 'text-blue-700' : ''}`}>
                            {folder.name}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default FileManager;
