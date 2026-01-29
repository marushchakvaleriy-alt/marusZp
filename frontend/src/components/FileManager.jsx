import React, { useState, useEffect } from 'react';
import { getFiles, addFileLink, deleteFileLink } from '../api';

const FileManager = ({ projectId, onBack }) => {
    const [currentFolder, setCurrentFolder] = useState(null);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form state
    const [newFileName, setNewFileName] = useState('');
    const [newFileUrl, setNewFileUrl] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const folders = [
        { name: 'Проджекти', icon: 'fa-project-diagram' },
        { name: 'Перекупні позиції', icon: 'fa-shopping-cart' },
        { name: 'Метал', icon: 'fa-hammer' },
        { name: 'Креслення', icon: 'fa-print' },
        { name: 'Погодження', icon: 'fa-file-signature' },
        { name: 'Фурнітура', icon: 'fa-boxes' }
    ];

    const loadFiles = async () => {
        try {
            setLoading(true);
            const data = await getFiles(projectId);
            setFiles(data);
        } catch (error) {
            console.error("Failed to load files:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) {
            loadFiles();
        }
    }, [projectId]);

    const handleAddLink = async (e) => {
        e.preventDefault();
        if (!newFileName || !newFileUrl) return;

        try {
            setIsAdding(true);
            await addFileLink(projectId, {
                name: newFileName,
                url: newFileUrl,
                folder_name: currentFolder
            });
            setNewFileName('');
            setNewFileUrl('');
            await loadFiles();
        } catch (error) {
            console.error("Failed to add link:", error);
            alert("Помилка при додаванні посилання");
        } finally {
            setIsAdding(false);
        }
    };

    const handleDelete = async (fileId) => {
        if (!window.confirm("Видалити це посилання?")) return;
        try {
            await deleteFileLink(fileId);
            await loadFiles();
        } catch (error) {
            console.error("Failed to delete link:", error);
        }
    };

    const currentFiles = files.filter(f => f.folder_name === currentFolder);

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
                    </div>

                    {/* Add Link Form */}
                    <div className="p-6 border-b border-slate-100 bg-slate-50">
                        <form onSubmit={handleAddLink} className="flex gap-4 items-end flex-wrap md:flex-nowrap">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Назва файлу</label>
                                <input
                                    type="text"
                                    value={newFileName}
                                    onChange={(e) => setNewFileName(e.target.value)}
                                    placeholder="Напр. Кухня План версія 1"
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-sm font-bold text-slate-700"
                                    required
                                />
                            </div>
                            <div className="flex-[2] min-w-[200px]">
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Посилання (Google Drive/Docs)</label>
                                <input
                                    type="url"
                                    value={newFileUrl}
                                    onChange={(e) => setNewFileUrl(e.target.value)}
                                    placeholder="https://drive.google.com/..."
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-sm font-bold text-slate-700"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isAdding}
                                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition disabled:opacity-50 h-[42px]"
                            >
                                {isAdding ? '...' : <><i className="fas fa-link mr-2"></i> Додати посилання</>}
                            </button>
                        </form>
                    </div>

                    <div className="p-4 space-y-2 min-h-[200px]">
                        {loading ? (
                            <p className="text-center text-slate-400 py-10 font-bold text-xs uppercase animate-pulse">Завантаження...</p>
                        ) : currentFiles.length === 0 ? (
                            <div className="text-center py-10 opacity-50">
                                <i className="fas fa-inbox text-4xl text-slate-300 mb-2"></i>
                                <p className="text-slate-400 text-xs font-bold uppercase">В цій папці поки немає посилань</p>
                            </div>
                        ) : (
                            currentFiles.map((file) => (
                                <div key={file.id} className="flex justify-between items-center p-4 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition group">
                                    <div className="flex items-center gap-4 overflow-hidden">
                                        <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center font-black text-xl shrink-0">
                                            <i className="fab fa-google-drive"></i>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-700 truncate">{file.name}</p>
                                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-600 font-bold uppercase italic truncate block hover:underline">
                                                {file.url}
                                            </a>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(file.id)}
                                        className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                                        title="Видалити"
                                    >
                                        <i className="fas fa-trash"></i>
                                    </button>
                                </div>
                            ))
                        )}
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
                        className="folder-btn p-6 rounded-3xl flex flex-col items-center gap-3 bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 hover:-translate-y-1 transition group"
                    >
                        <i className={`fas ${folder.icon} text-2xl text-slate-300 group-hover:text-blue-500 transition`}></i>
                        <span className="text-[10px] font-bold uppercase italic text-center text-slate-500 group-hover:text-blue-700">
                            {folder.name}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default FileManager;
