import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { saveAs } from 'file-saver';
import { Upload, Download, Edit, Trash2, Plus, ChevronRight, X, AlertCircle, CheckCircle, Save, Undo, Search, Server, FileText, Globe, Sun, Moon } from 'lucide-react';

const API_URL_FRONTEND = 'http://localhost:5001/api/data';

const api_frontend = {
    getData: () => axios.get(API_URL_FRONTEND),
    saveData: (data) => axios.post(API_URL_FRONTEND, data),
    importFile: (formData) => axios.post(`${API_URL_FRONTEND}/import`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    exportFile: () => axios.get(`${API_URL_FRONTEND}/export`, { responseType: 'blob' }),
    search: (term, field) => axios.get(`${API_URL_FRONTEND}/search?term=${term}&field=${field}`),
};

const getItem = (data, path) => {
    if (!path || !data) return null;
    const { regionIdx, locationIdx, deviceIdx } = path;
    if (regionIdx === undefined || !data[regionIdx]) return null;
    const region = data[regionIdx];
    if (locationIdx === undefined) return region;
    if (!region.locations || !region.locations[locationIdx]) return null;
    const location = region.locations[locationIdx];
    if (deviceIdx === undefined) return location;
    if (!location.devices || !location.devices[deviceIdx]) return null;
    return location.devices[deviceIdx];
};

const Toast = ({ message, type, onClose, onUndo }) => {
    if (!message) return null;
    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
    const Icon = type === 'success' ? CheckCircle : AlertCircle;
    useEffect(() => {
        if (!onUndo) {
            const timer = setTimeout(onClose, 3000);
            return () => clearTimeout(timer);
        }
    }, [onClose, onUndo]);
    return (
        <div className={`fixed bottom-5 right-5 text-white p-4 rounded-lg shadow-lg flex items-center ${bgColor} z-[70]`}>
            <Icon className="mr-3" />
            <span>{message}</span>
            {onUndo && (
                <button onClick={onUndo} className="ml-4 font-bold bg-white/20 hover:bg-white/40 p-1 rounded flex items-center gap-1 text-sm">
                    <Undo size={14} /> Undo
                </button>
            )}
            <button onClick={onClose} className="ml-4 font-bold">X</button>
        </div>
    );
};

const SubDeviceModal = ({ device, onSave, onCancel }) => {
    const [name, setName] = useState(device ? device.name : '');
    const [ip, setIp] = useState(device ? device.ip : '');
    const handleSave = () => { if (name && ip) onSave({ name, ip }); };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-[60]">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-xl w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">{device ? 'Edit' : 'Add'} Sub-Device</h3>
                <div className="space-y-3">
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Device Name" className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded" />
                    <input value={ip} onChange={e => setIp(e.target.value)} placeholder="Specific IP" className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded" />
                </div>
                <div className="mt-5 flex justify-end space-x-3">
                    <button onClick={onCancel} className="bg-gray-200 dark:bg-gray-600 text-black dark:text-white px-4 py-2 rounded">Cancel</button>
                    <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded">Save</button>
                </div>
            </div>
        </div>
    );
};

const ItemModal = ({ isOpen, onClose, onUpdate, initialData, itemPath, mode }) => {
    const [itemData, setItemData] = useState(null);
    const [ipType, setIpType] = useState('single');
    const [isSubDeviceModalOpen, setSubDeviceModalOpen] = useState(false);
    const [editingSubDeviceIndex, setEditingSubDeviceIndex] = useState(null);
    const modalRef = useRef(null);

    useEffect(() => {
        let item;
        if (mode === 'edit') item = JSON.parse(JSON.stringify(getItem(initialData, itemPath)));
        else {
            const { regionIdx, locationIdx, deviceIdx } = itemPath;
            if (deviceIdx !== undefined) item = { type: 'New Device', ip: '', description: '', status: '', sub_devices: [] };
            else if (locationIdx !== undefined) item = { name: 'New Location', network_id: '', devices: [] };
            else item = { name: 'New Region', locations: [] };
        }
        setItemData(item);
        if (item && item.ip) {
            if (item.ip.includes('to')) setIpType('range');
            else if (item.ip.includes(',') || item.ip.includes('and')) setIpType('multiple');
            else setIpType('single');
        }
    }, [initialData, itemPath, isOpen, mode]);
    
    const handleSave = useCallback(() => { onUpdate(itemData, itemPath, mode); onClose(); }, [itemData, itemPath, mode, onClose, onUpdate]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Enter') {
                handleSave();
            }
        };
        const modalElement = modalRef.current;
        if (modalElement) {
            modalElement.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            if (modalElement) {
                modalElement.removeEventListener('keydown', handleKeyDown);
            }
        };
    }, [handleSave]);


    const handleChange = (e) => setItemData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleIpTypeChange = (type) => { setIpType(type); setItemData(prev => ({...prev, ip: ''})); };
    const handleSubDeviceSave = (subDevice) => {
        const updatedSubDevices = [...(itemData.sub_devices || [])];
        if (editingSubDeviceIndex !== null) updatedSubDevices[editingSubDeviceIndex] = subDevice;
        else updatedSubDevices.push(subDevice);
        setItemData(prev => ({...prev, sub_devices: updatedSubDevices}));
        setSubDeviceModalOpen(false);
        setEditingSubDeviceIndex(null);
    };
    const handleSubDeviceRemove = (index) => {
        const updatedSubDevices = itemData.sub_devices.filter((_, i) => i !== index);
        setItemData(prev => ({...prev, sub_devices: updatedSubDevices}));
    };

    if (!isOpen || !itemData) return null;
    const isRegion = 'locations' in itemData, isLocation = 'devices' in itemData, isDevice = !isRegion && !isLocation;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div ref={modalRef} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold">{mode.charAt(0).toUpperCase() + mode.slice(1)} Entry</h2><button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"><X size={24} /></button></div>
                <div className="space-y-4">
                    {isRegion && <input name="name" value={itemData.name || ''} onChange={handleChange} placeholder="Region Name" className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded" />}
                    {isLocation && <><input name="name" value={itemData.name || ''} onChange={handleChange} placeholder="Location Name" className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded" /><input name="network_id" value={itemData.network_id || ''} onChange={handleChange} placeholder="Network ID" className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded" /></>}
                    {isDevice && <><input name="type" value={itemData.type || ''} onChange={handleChange} placeholder="Type / Interface" className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded" /><div className="p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900/50"><label className="font-semibold text-gray-700 dark:text-gray-300">IP Address Type</label><div className="flex space-x-4 mt-2 mb-3">{['single', 'range', 'multiple'].map(type => (<button key={type} onClick={() => handleIpTypeChange(type)} className={`px-3 py-1 text-sm rounded-md ${ipType === type ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>{type.charAt(0).toUpperCase() + type.slice(1)}</button>))}</div>{ipType === 'single' && <input name="ip" value={itemData.ip || ''} onChange={handleChange} placeholder="IP Address" className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded" />}{ipType === 'range' && <input name="ip" value={itemData.ip || ''} onChange={handleChange} placeholder="e.g., 192.168.1.10 to 192.168.1.20" className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded" />}{ipType === 'multiple' && <input name="ip" value={itemData.ip || ''} onChange={handleChange} placeholder="e.g., 10.0.0.1, 10.0.0.2" className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded" />}</div>{ipType === 'range' && (<div className="p-3 border border-gray-200 dark:border-gray-700 rounded-md"><div className="flex justify-between items-center mb-2"><h4 className="font-semibold text-gray-700 dark:text-gray-300">Sub-Devices in Range</h4><button onClick={() => { setEditingSubDeviceIndex(null); setSubDeviceModalOpen(true); }} className="bg-indigo-600 text-white text-sm py-1 px-2 rounded">Add Sub-Device</button></div><ul className="space-y-1 max-h-40 overflow-y-auto">{(itemData.sub_devices || []).map((sd, idx) => (<li key={idx} className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-700/50 rounded"><span>{sd.name} ({sd.ip})</span><div className="space-x-2"><button onClick={() => { setEditingSubDeviceIndex(idx); setSubDeviceModalOpen(true); }} className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"><Edit size={16}/></button><button onClick={() => handleSubDeviceRemove(idx)} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"><Trash2 size={16}/></button></div></li>))}</ul></div>)}<input name="description" value={itemData.description || ''} onChange={handleChange} placeholder="Description" className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded" /><input name="status" value={itemData.status || ''} onChange={handleChange} placeholder="Status" className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded" /></>}
                </div>
                <div className="mt-6 flex justify-end space-x-4"><button onClick={onClose} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white px-4 py-2 rounded">Cancel</button><button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded">Confirm</button></div>
            </div>
            {isSubDeviceModalOpen && <SubDeviceModal device={editingSubDeviceIndex !== null ? itemData.sub_devices[editingSubDeviceIndex] : null} onSave={handleSubDeviceSave} onCancel={() => setSubDeviceModalOpen(false)} />}
        </div>
    );
};

const DataTable = ({ region, onSelect, selectedPath }) => {
    const [expanded, setExpanded] = useState({});
    useEffect(() => {
        const initialExpanded = {};
        if (region && region.locations) {
            region.locations.forEach((_, lIdx) => initialExpanded[`l-${lIdx}`] = true);
        }
        setExpanded(initialExpanded);
    }, [region]);

    if (!region) return <div className="p-10 text-center text-gray-500">Select a region to view its data.</div>;
    const isSelected = (path) => JSON.stringify(path) === JSON.stringify(selectedPath);

    return (
        <div className="overflow-x-auto h-full">
            <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-white/5 sticky top-0 backdrop-blur-sm">
                    <tr>
                        <th className="w-2/5 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name / Type</th>
                        <th className="w-1/4 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">IP / Network ID</th>
                        <th className="w-1/4 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                        <th className="w-1/10 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                    {region.locations && region.locations.map((loc, locIdx) => {
                        if (!loc) return null;
                        return (
                            <React.Fragment key={`loc-${locIdx}`}>
                                <tr onClick={() => onSelect({ regionIdx: region.index, locationIdx: locIdx })} className={`cursor-pointer transition-colors duration-150 ${isSelected({ regionIdx: region.index, locationIdx: locIdx }) ? 'bg-indigo-500/20' : 'odd:bg-black/5 dark:odd:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'}`}>
                                    <td className="pl-4 pr-6 py-2 font-semibold text-gray-900 dark:text-gray-200 flex items-center justify-between">
                                        <span>{loc.name || '(No Name)'}</span>
                                        <button onClick={(e) => { e.stopPropagation(); setExpanded(p => ({ ...p, [`l-${locIdx}`]: !p[`l-${locIdx}`] })); }} className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                                            <ChevronRight className={`transform transition-transform duration-200 ${expanded[`l-${locIdx}`] ? 'rotate-90' : ''}`} size={16} />
                                        </button>
                                    </td>
                                    <td className="px-6 py-2 text-gray-500 dark:text-gray-400">{loc.network_id || ''}</td>
                                    <td colSpan="2"></td>
                                </tr>
                                {expanded[`l-${locIdx}`] && loc.devices?.map((dev, devIdx) => {
                                    if (!dev) return null;
                                    return (
                                        <tr key={`dev-${devIdx}`} onClick={() => onSelect({ regionIdx: region.index, locationIdx: locIdx, deviceIdx: devIdx })} className={`cursor-pointer text-sm transition-colors duration-150 ${isSelected({ regionIdx: region.index, locationIdx: locIdx, deviceIdx: devIdx }) ? 'bg-indigo-500/20' : 'odd:bg-black/5 dark:odd:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'}`}>
                                            <td className="pl-12 pr-6 py-2 text-gray-700 dark:text-gray-300">{dev.type || '(No Type)'}</td>
                                            <td className="px-6 py-2 text-gray-500 dark:text-gray-400">{dev.ip || ''}</td>
                                            <td className="px-6 py-2 text-gray-500 dark:text-gray-400">{dev.description || ''}</td>
                                            <td className="px-6 py-2 text-gray-500 dark:text-gray-400">{dev.status || ''}</td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const SearchResultsModal = ({ isOpen, onClose, results, isLoading }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Search Results</h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"><X size={24} /></button>
                </div>
                <div className="overflow-y-auto">
                    {isLoading ? <p className="text-gray-500 dark:text-gray-400">Searching...</p> :
                        results.length > 0 ? (
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Region</th>
                                        <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Location</th>
                                        <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Device Type</th>
                                        <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">IP Address</th>
                                        <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                                    {results.map((r, i) => (
                                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-4 py-2 text-gray-800 dark:text-gray-300">{r.regionName}</td>
                                            <td className="px-4 py-2 text-gray-800 dark:text-gray-300">{r.locationName}</td>
                                            <td className="px-4 py-2 text-gray-800 dark:text-gray-300">{r.device.type}</td>
                                            <td className="px-4 py-2 font-mono text-indigo-600 dark:text-cyan-400">{r.device.ip}</td>
                                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{r.device.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : <p className="text-gray-500 dark:text-gray-400">No results found for this search term.</p>
                    }
                </div>
            </div>
        </div>
    );
};


function App() {
    const [data, setData] = useState([]);
    const [selectedRegionIndex, setSelectedRegionIndex] = useState(null);
    const [selectedPath, setSelectedPath] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState({ mode: 'add', path: null });
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState({ message: '', type: '', onUndo: null });
    const undoTimeoutRef = useRef(null);
    const [isSearchModalOpen, setSearchModalOpen] = useState(false);
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [specificSearchQuery, setSpecificSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchField, setSearchField] = useState('ip');
    const [theme, setTheme] = useState('dark');

    useEffect(() => {
        const storedTheme = localStorage.getItem('theme');
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        setTheme(storedTheme || systemTheme);
    }, []);

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove(theme === 'dark' ? 'light' : 'dark');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const showToast = (message, type = 'success', onUndo = null) => {
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        setToast({ message, type, onUndo });
    };

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await api_frontend.getData();
            setData(response.data);
            if (response.data.length > 0 && selectedRegionIndex === null) {
                setSelectedRegionIndex(0);
            } else if (response.data.length === 0) {
                setSelectedRegionIndex(null);
            }
            setSelectedPath(null);
        } catch (error) {
            showToast('Failed to fetch data. Is backend running?', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [selectedRegionIndex]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const updateAndSyncData = useCallback(async (updatedData, successMessage) => {
        setData(updatedData);
        try {
            await api_frontend.saveData(updatedData);
            if (successMessage) showToast(successMessage);
        } catch (error) {
            showToast('Sync failed. Reverting changes.', 'error');
            fetchData();
        }
    }, [fetchData]);

    const handleImport = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('file', file);
        setIsLoading(true);
        try {
            const response = await api_frontend.importFile(formData);
            setData(response.data);
            if (response.data.length > 0) setSelectedRegionIndex(0);
            showToast('File imported and saved successfully!');
        } catch (error) {
            showToast(error.response?.data?.message || 'Import failed.', 'error');
        } finally {
            setIsLoading(false);
            event.target.value = null;
        }
    };

    const handleExport = () => api_frontend.exportFile().then(res => saveAs(res.data, 'network_infra.xlsx')).catch(() => showToast('Export failed.', 'error'));

    const handleModalUpdate = (itemData, path, mode) => {
        const newData = JSON.parse(JSON.stringify(data));
        const { regionIdx, locationIdx } = path;

        if (mode === 'edit') {
            const { deviceIdx } = path;
            if (deviceIdx !== undefined) newData[regionIdx].locations[locationIdx].devices[deviceIdx] = itemData;
            else if (locationIdx !== undefined) newData[regionIdx].locations[locationIdx] = itemData;
            else newData[regionIdx] = itemData;
        } else {
            if (path.deviceIdx !== undefined) {
                if (!newData[regionIdx].locations[locationIdx].devices) newData[regionIdx].locations[locationIdx].devices = [];
                newData[regionIdx].locations[locationIdx].devices.push(itemData);
                const newDeviceIndex = newData[regionIdx].locations[locationIdx].devices.length - 1;
                setSelectedPath({ regionIdx, locationIdx, deviceIdx: newDeviceIndex });
            } else if (path.locationIdx !== undefined) {
                if (!newData[regionIdx].locations) newData[regionIdx].locations = [];
                newData[regionIdx].locations.push(itemData);
                const newLocationIndex = newData[regionIdx].locations.length - 1;
                setSelectedPath({ regionIdx, locationIdx: newLocationIndex });
            } else {
                newData.push(itemData);
                const newRegionIndex = newData.length - 1;
                setSelectedRegionIndex(newRegionIndex);
                setSelectedPath(null);
            }
        }
        updateAndSyncData(newData, "Entry updated successfully!");
    };
    
    const handleUndo = (originalData) => {
        clearTimeout(undoTimeoutRef.current);
        updateAndSyncData(originalData, "Action undone.");
    };

    const handleRemove = useCallback((pathToDelete) => {
        if (!pathToDelete) return;

        const originalData = JSON.parse(JSON.stringify(data));
        if (!window.confirm("Delete selected item?")) return;

        const newData = JSON.parse(JSON.stringify(data));
        const { regionIdx, locationIdx, deviceIdx } = pathToDelete;

        if (deviceIdx !== undefined) newData[regionIdx].locations[locationIdx].devices.splice(deviceIdx, 1);
        else if (locationIdx !== undefined) newData[regionIdx].locations.splice(locationIdx, 1);
        else {
            newData.splice(regionIdx, 1);
            if (selectedRegionIndex >= newData.length) setSelectedRegionIndex(newData.length > 0 ? newData.length - 1 : null);
        }
        
        setData(newData);
        setSelectedPath(null);

        showToast("Item removed.", "success", () => handleUndo(originalData));
        undoTimeoutRef.current = setTimeout(() => {
            updateAndSyncData(newData);
        }, 5000);
    }, [data, selectedRegionIndex, updateAndSyncData]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Delete' || event.key === 'Backspace') {
                if (document.activeElement.tagName.toLowerCase() !== 'input') {
                    if (selectedPath) handleRemove(selectedPath);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleRemove, selectedPath]);

    const handleSearch = async (term, field) => {
        if (!term.trim()) return;
        setIsSearching(true);
        setSearchModalOpen(true);
        try {
            const response = await api_frontend.search(term, field);
            setSearchResults(response.data);
        } catch (error) {
            showToast("Search failed.", "error");
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };


    const openModal = (mode, path) => { setModalConfig({ mode, path }); setIsModalOpen(true); };
    const handleAddRegion = () => openModal('add', {});
    const handleAddLocation = () => {
        if (selectedRegionIndex === null) return;
        openModal('add', { regionIdx: selectedRegionIndex, locationIdx: -1 });
    };
    const handleAddDevice = () => {
        if (!selectedPath || selectedPath.deviceIdx !== undefined) return;
        openModal('add', { ...selectedPath, deviceIdx: -1 });
    };
    const handleEditSelected = () => {
        if (!selectedPath) return;
        openModal('edit', selectedPath);
    };

    const selectedRegion = (selectedRegionIndex !== null && data[selectedRegionIndex]) ? { ...data[selectedRegionIndex], index: selectedRegionIndex } : null;

    return (
        <div className={`h-screen w-screen flex font-sans transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} onUndo={toast.onUndo} />
            {isModalOpen && <ItemModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onUpdate={handleModalUpdate} initialData={data} itemPath={modalConfig.path} mode={modalConfig.mode} />}
            <SearchResultsModal isOpen={isSearchModalOpen} onClose={() => setSearchModalOpen(false)} results={searchResults} isLoading={isSearching} />
            
            <aside className="w-80 bg-white/5 backdrop-blur-sm border-r border-white/10 p-4 flex flex-col shrink-0">
                <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3">
                        <Server className="text-indigo-400" size={32}/>
                        <h1 className="text-2xl font-bold text-white">Net Manager</h1>
                    </div>
                    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </div>
                <div className="space-y-4 flex-grow">
                    <div className="p-4 bg-black/20 border border-white/10 rounded-lg">
                        <h2 className="font-semibold text-gray-300 mb-2">Controls</h2>
                        <select value={selectedRegionIndex ?? ''} onChange={e => { setSelectedRegionIndex(Number(e.target.value)); setSelectedPath(null); }} className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded mb-3 shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="" disabled>Select a Region...</option>
                            {data.map((r, i) => <option key={i} value={i}>{r.name}</option>)}
                        </select>
                        <button onClick={handleAddRegion} className="w-full text-left bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700 mb-2 transition-colors duration-200">Add New Region</button>
                        <button onClick={() => handleRemove({ regionIdx: selectedRegionIndex })} disabled={selectedRegionIndex === null} className="w-full text-left bg-red-600 text-white p-2 rounded hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors duration-200">Delete Selected Region</button>
                        <hr className="my-3 border-gray-700"/>
                        <button onClick={handleAddLocation} disabled={selectedRegionIndex === null} className="w-full text-left bg-cyan-600 text-white p-2 rounded hover:bg-cyan-700 mb-2 disabled:bg-cyan-400 disabled:cursor-not-allowed transition-colors duration-200">Add New Location</button>
                        <button onClick={handleAddDevice} disabled={!selectedPath || selectedPath.deviceIdx !== undefined} className="w-full text-left bg-green-600 text-white p-2 rounded hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors duration-200">Add New Device/Entry</button>
                        <hr className="my-3 border-gray-700"/>
                        <button onClick={handleEditSelected} disabled={!selectedPath} className="w-full text-left bg-amber-500 text-white p-2 rounded hover:bg-amber-600 mb-2 disabled:bg-amber-400 disabled:cursor-not-allowed transition-colors duration-200">Edit Selected Entry</button>
                        <button onClick={() => handleRemove(selectedPath)} disabled={!selectedPath} className="w-full text-left bg-red-600 text-white p-2 rounded hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors duration-200">Remove Selected Entry</button>
                    </div>
                    <div className="p-4 bg-black/20 border border-white/10 rounded-lg">
                        <h2 className="font-semibold text-gray-300 mb-2">Data Management</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm font-medium text-gray-400">Global Search</label>
                                <div className="flex">
                                    <input type="text" value={globalSearchQuery} onChange={e => setGlobalSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch(globalSearchQuery, 'global')} placeholder="Search all fields..." className="w-full p-2 border border-gray-600 bg-gray-700 rounded-l-md focus:ring-indigo-500 focus:border-indigo-500" />
                                    <button onClick={() => handleSearch(globalSearchQuery, 'global')} className="bg-gray-700 text-white p-2 rounded-r-md hover:bg-gray-600"><Search size={20}/></button>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-400">Specific Search</label>
                                <div className="flex">
                                    <select value={searchField} onChange={e => setSearchField(e.target.value)} className="p-2 border border-r-0 border-gray-600 rounded-l-md bg-gray-800 focus:ring-indigo-500 focus:border-indigo-500">
                                        <option value="ip">IP</option>
                                        <option value="location">Location</option>
                                        <option value="region">Region</option>
                                        <option value="type">Name/Type</option>
                                    </select>
                                    <input type="text" value={specificSearchQuery} onChange={e => setSpecificSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch(specificSearchQuery, searchField)} placeholder="Search by category..." className="w-full p-2 border border-gray-600 bg-gray-700 focus:ring-indigo-500 focus:border-indigo-500" />
                                    <button onClick={() => handleSearch(specificSearchQuery, searchField)} className="bg-gray-700 text-white p-2 rounded-r-md hover:bg-gray-600"><Search size={20}/></button>
                                </div>
                            </div>
                        </div>
                        <hr className="my-4 border-gray-700"/>
                        <button onClick={() => document.getElementById('fileInput').click()} className="w-full flex items-center gap-2 text-left bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700 mb-2 transition-colors duration-200"><Upload size={16}/> Import from Excel</button>
                        <input type="file" id="fileInput" className="hidden" onChange={handleImport} accept=".xlsx,.xls"/>
                        <button onClick={handleExport} className="w-full flex items-center gap-2 text-left bg-green-600 text-white p-2 rounded hover:bg-green-700 transition-colors duration-200"><Download size={16}/> Export to Excel</button>
                    </div>
                </div>
            </aside>

            <main className="flex-grow p-6 flex flex-col">
                <div className="bg-white dark:bg-white/5 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 dark:border-white/10 flex-grow overflow-y-auto">
                    {isLoading ? <div className="p-10 text-center text-gray-500 dark:text-gray-400">Loading...</div> : <DataTable region={selectedRegion} onSelect={setSelectedPath} selectedPath={selectedPath} />}
                </div>
            </main>
        </div>
    );
}

export default App;
