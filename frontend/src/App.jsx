import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { saveAs } from 'file-saver';
import { Upload, Download, Edit, Trash2, Plus, ChevronRight, X, AlertCircle, CheckCircle, Save, Undo, Search, Server, FileText, Globe, Sun, Moon, ListChecks } from 'lucide-react';

const API_URL_FRONTEND = 'http://localhost:5001/api/data';

const api_frontend = {
    getData: () => axios.get(API_URL_FRONTEND),
    saveData: (data) => axios.post(API_URL_FRONTEND, data),
    importFile: (formData) => axios.post(`${API_URL_FRONTEND}/import`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    exportFile: () => axios.get(`${API_URL_FRONTEND}/export`, { responseType: 'blob' }),
    search: (term, field, regionName = null) => {
        let url = `${API_URL_FRONTEND}/search?term=${term}&field=${field}`;
        if (regionName) {
            url += `&regionName=${encodeURIComponent(regionName)}`;
        }
        return axios.get(url);
    },
    checkSerials: (formData) => axios.post(`${API_URL_FRONTEND}/check-serials`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
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
            <div className="bg-white p-5 rounded-lg shadow-xl w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4 text-gray-900">{device ? 'Edit' : 'Add'} Sub-Device</h3>
                <div className="space-y-3">
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Device Name" className="w-full p-2 border border-gray-300 bg-white rounded" />
                    <input value={ip} onChange={e => setIp(e.target.value)} placeholder="Specific IP" className="w-full p-2 border border-gray-300 bg-white rounded" />
                </div>
                <div className="mt-5 flex justify-end space-x-3">
                    <button onClick={onCancel} className="bg-gray-200 text-black px-4 py-2 rounded">Cancel</button>
                    <button onClick={handleSave} className="bg-black text-white px-4 py-2 rounded">Save</button>
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
    const nameInputRef = useRef(null);

    useEffect(() => {
        let item;
        if (mode === 'edit') item = JSON.parse(JSON.stringify(getItem(initialData, itemPath)));
        else {
            const { regionIdx, locationIdx, deviceIdx } = itemPath;
            const timestamp = Date.now();
            if (deviceIdx !== undefined) item = { type: `New Device ${timestamp}`, ip: '', description: '', status: '', sub_devices: [] };
            else if (locationIdx !== undefined) item = { name: `New Location ${timestamp}`, network_id: '', devices: [] };
            else item = { name: `New Region ${timestamp}`, locations: [] };
        }
        setItemData(item);
        if (item && item.ip) {
            if (item.ip.includes('to')) setIpType('range');
            else if (item.ip.includes(',') || item.ip.includes('and')) setIpType('multiple');
            else setIpType('single');
        }
    }, [initialData, itemPath, isOpen, mode]);

    useEffect(() => {
        if (isOpen && nameInputRef.current) {
            setTimeout(() => nameInputRef.current.focus(), 100);
        }
    }, [isOpen]);
    
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
            <div ref={modalRef} className="bg-white text-gray-900 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold">{mode.charAt(0).toUpperCase() + mode.slice(1)} Entry</h2><button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={24} /></button></div>
                <div className="space-y-4">
                    {isRegion && <input ref={nameInputRef} name="name" value={itemData.name || ''} onChange={handleChange} placeholder="Region Name" className="w-full p-2 border border-gray-300 bg-white rounded" />}
                    {isLocation && <><input ref={nameInputRef} name="name" value={itemData.name || ''} onChange={handleChange} placeholder="Location Name" className="w-full p-2 border border-gray-300 bg-white rounded" /><input name="network_id" value={itemData.network_id || ''} onChange={handleChange} placeholder="Network ID" className="w-full p-2 border border-gray-300 bg-white rounded" /></>}
                    {isDevice && <><input ref={nameInputRef} name="type" value={itemData.type || ''} onChange={handleChange} placeholder="Type / Interface" className="w-full p-2 border border-gray-300 bg-white rounded" /><div className="p-3 border border-gray-200 rounded-md bg-gray-50"><label className="font-semibold text-gray-700">IP Address Type</label><div className="flex space-x-4 mt-2 mb-3">{['single', 'range', 'multiple'].map(type => (<button key={type} onClick={() => handleIpTypeChange(type)} className={`px-3 py-1 text-sm rounded-md ${ipType === type ? 'bg-black text-white' : 'bg-gray-200'}`}>{type.charAt(0).toUpperCase() + type.slice(1)}</button>))}</div>{ipType === 'single' && <input name="ip" value={itemData.ip || ''} onChange={handleChange} placeholder="IP Address" className="w-full p-2 border border-gray-300 bg-white rounded" />}{ipType === 'range' && <input name="ip" value={itemData.ip || ''} onChange={handleChange} placeholder="e.g., 192.168.1.10 to 192.168.1.20" className="w-full p-2 border border-gray-300 bg-white rounded" />}{ipType === 'multiple' && <input name="ip" value={itemData.ip || ''} onChange={handleChange} placeholder="e.g., 10.0.0.1, 10.0.0.2" className="w-full p-2 border border-gray-300 bg-white rounded" />}</div>{ipType === 'range' && (<div className="p-3 border border-gray-200 rounded-md"><div className="flex justify-between items-center mb-2"><h4 className="font-semibold text-gray-700">Sub-Devices in Range</h4><button onClick={() => { setEditingSubDeviceIndex(null); setSubDeviceModalOpen(true); }} className="bg-black text-white text-sm py-1 px-2 rounded">Add Sub-Device</button></div><ul className="space-y-1 max-h-40 overflow-y-auto">{(itemData.sub_devices || []).map((sd, idx) => (<li key={idx} className="flex justify-between items-center p-2 bg-gray-100 rounded"><span>{sd.name} ({sd.ip})</span><div className="space-x-2"><button onClick={() => { setEditingSubDeviceIndex(idx); setSubDeviceModalOpen(true); }} className="text-gray-500 hover:text-black"><Edit size={16}/></button><button onClick={() => handleSubDeviceRemove(idx)} className="text-gray-500 hover:text-black"><Trash2 size={16}/></button></div></li>))}</ul></div>)}<input name="description" value={itemData.description || ''} onChange={handleChange} placeholder="Description" className="w-full p-2 border border-gray-300 bg-white rounded" /><input name="status" value={itemData.status || ''} onChange={handleChange} placeholder="Status" className="w-full p-2 border border-gray-300 bg-white rounded" /></>}
                </div>
                <div className="mt-6 flex justify-end space-x-4"><button onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded">Cancel</button><button onClick={handleSave} className="bg-black text-white px-4 py-2 rounded">Confirm</button></div>
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
                <thead className="bg-gray-50 sticky top-0 backdrop-blur-sm">
                    <tr>
                        <th className="w-2/5 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name / Type</th>
                        <th className="w-1/4 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP / Network ID</th>
                        <th className="w-1/4 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="w-1/10 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {region.locations && region.locations.map((loc, locIdx) => {
                        if (!loc) return null;
                        return (
                            <React.Fragment key={`loc-${locIdx}`}>
                                <tr onClick={() => onSelect({ regionIdx: region.index, locationIdx: locIdx })} className={`cursor-pointer transition-colors duration-150 ${isSelected({ regionIdx: region.index, locationIdx: locIdx }) ? 'bg-black/20' : 'odd:bg-black/5 hover:bg-black/10'}`}>
                                    <td className="pl-4 pr-6 py-2 font-semibold text-gray-900 flex items-center justify-between">
                                        <span>{loc.name || '(No Name)'}</span>
                                        <button onClick={(e) => { e.stopPropagation(); setExpanded(p => ({ ...p, [`l-${locIdx}`]: !p[`l-${locIdx}`] })); }} className="p-1 rounded-full hover:bg-black/10">
                                            <ChevronRight className={`transform transition-transform duration-200 ${expanded[`l-${locIdx}`] ? 'rotate-90' : ''}`} size={16} />
                                        </button>
                                    </td>
                                    <td className="px-6 py-2 text-gray-500">{loc.network_id || ''}</td>
                                    <td colSpan="2"></td>
                                </tr>
                                {expanded[`l-${locIdx}`] && loc.devices?.map((dev, devIdx) => {
                                    if (!dev) return null;
                                    return (
                                        <tr key={`dev-${devIdx}`} onClick={() => onSelect({ regionIdx: region.index, locationIdx: locIdx, deviceIdx: devIdx })} className={`cursor-pointer text-sm transition-colors duration-150 ${isSelected({ regionIdx: region.index, locationIdx: locIdx, deviceIdx: devIdx }) ? 'bg-black/20' : 'odd:bg-black/5 hover:bg-black/10'}`}>
                                            <td className="pl-12 pr-6 py-2 text-gray-700">{dev.type || '(No Type)'}</td>
                                            <td className="px-6 py-2 text-gray-500">{dev.ip || ''}</td>
                                            <td className="px-6 py-2 text-gray-500">{dev.description || ''}</td>
                                            <td className="px-6 py-2 text-gray-500">{dev.status || ''}</td>
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

const SearchResultsModal = ({ isOpen, onClose, results, isLoading, onResultClick }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white text-gray-900 rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Search Results</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
                </div>
                <div className="overflow-y-auto">
                    {isLoading ? <p className="text-gray-500">Searching...</p> :
                        results.length > 0 ? (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-gray-600">Region</th>
                                        <th className="px-4 py-2 text-left text-gray-600">Location</th>
                                        <th className="px-4 py-2 text-left text-gray-600">Device Type</th>
                                        <th className="px-4 py-2 text-left text-gray-600">IP Address</th>
                                        <th className="px-4 py-2 text-left text-gray-600">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                    {results.map((r, i) => (
                                        <tr key={i} className="hover:bg-gray-50 cursor-pointer" onClick={() => onResultClick(r)}>
                                            <td className="px-4 py-2 text-gray-800">{r.regionName}</td>
                                            <td className="px-4 py-2 text-gray-800">{r.locationName}</td>
                                            <td className="px-4 py-2 text-gray-800">{r.device.type}</td>
                                            <td className="px-4 py-2 font-mono text-black">{r.device.ip}</td>
                                            <td className="px-4 py-2 text-gray-500">{r.device.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : <p className="text-gray-500">No results found for this search term.</p>
                    }
                </div>
            </div>
        </div>
    );
};

// --- FIX: New component for the Available Serials view ---
const AvailableSerialsView = ({ serialData }) => {
    if (!serialData || Object.keys(serialData).length === 0) {
        return <div className="p-10 text-center text-gray-500">Upload a serials file using the "Check Serials" button to see available IPs.</div>;
    }

    return (
        <div className="p-6 overflow-y-auto h-full">
            <h2 className="text-2xl font-bold mb-4">Available Serial IPs</h2>
            <div className="space-y-6">
                {Object.keys(serialData).map(regionName => (
                    <div key={regionName}>
                        <h3 className="text-lg font-semibold border-b border-gray-200 pb-2 mb-2">{regionName}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-2">
                            {serialData[regionName].map(({ ip, isUsed }) => (
                                <span key={ip} className={`font-mono text-sm ${isUsed ? 'text-blue-600' : 'text-black'}`}>
                                    {ip}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
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
    // --- FIX: State for new tabs ---
    const [activeTab, setActiveTab] = useState('dashboard');
    const [availableSerials, setAvailableSerials] = useState(null);

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

    const handleCheckSerials = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        setIsLoading(true);
        try {
            const response = await api_frontend.checkSerials(formData);
            setAvailableSerials(response.data);
            setActiveTab('serials');
            showToast('Available serials checked and updated!');
        } catch (error) {
            showToast('Failed to check serials.', 'error');
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
            const regionName = field === 'global' ? null : data[selectedRegionIndex]?.name;
            const response = await api_frontend.search(term, field, regionName);
            setSearchResults(response.data);
        } catch (error) {
            showToast("Search failed.", "error");
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleResultClick = (result) => {
        const { regionName, locationName, device } = result;
        const regionIdx = data.findIndex(r => r.name === regionName);
        if (regionIdx === -1) return;
        const locationIdx = data[regionIdx].locations.findIndex(l => l.name === locationName);
        if (locationIdx === -1) return;
        const deviceIdx = data[regionIdx].locations[locationIdx].devices.findIndex(
            d => d.ip === device.ip && d.type === device.type && d.description === device.description
        );
        if (deviceIdx === -1) return;

        setActiveTab('dashboard');
        setSelectedRegionIndex(regionIdx);
        setSelectedPath({ regionIdx, locationIdx, deviceIdx });
        setSearchModalOpen(false);
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
        <div className="h-screen w-screen flex flex-col font-sans bg-gray-100 text-gray-800">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} onUndo={toast.onUndo} />
            {isModalOpen && <ItemModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onUpdate={handleModalUpdate} initialData={data} itemPath={modalConfig.path} mode={modalConfig.mode} />}
            <SearchResultsModal isOpen={isSearchModalOpen} onClose={() => setSearchModalOpen(false)} results={searchResults} isLoading={isSearching} onResultClick={handleResultClick} />
            
            <header className="bg-white border-b border-gray-200 p-4 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Server className="text-black" size={28}/>
                        <h1 className="text-xl font-bold text-black">Network Manager</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <select value={selectedRegionIndex ?? ''} onChange={e => { setSelectedRegionIndex(Number(e.target.value)); setSelectedPath(null); }} className="p-2 border border-gray-300 bg-white text-black rounded shadow-sm focus:ring-black focus:border-black">
                            <option value="" disabled>Select a Region...</option>
                            {data.map((r, i) => <option key={i} value={i}>{r.name}</option>)}
                        </select>
                         <button onClick={() => document.getElementById('fileInput').click()} className="flex items-center gap-2 text-left bg-black text-white p-2 rounded hover:bg-gray-800 transition-colors duration-200"><Upload size={16}/> Import Data</button>
                        <input type="file" id="fileInput" className="hidden" onChange={handleImport} accept=".xlsx,.xls"/>
                        <button onClick={() => document.getElementById('serialFileInput').click()} className="flex items-center gap-2 text-left bg-black text-white p-2 rounded hover:bg-gray-800 transition-colors duration-200"><ListChecks size={16}/> Check Serials</button>
                        <input type="file" id="serialFileInput" className="hidden" onChange={handleCheckSerials} accept=".xlsx,.xls"/>
                        <button onClick={handleExport} className="flex items-center gap-2 text-left bg-black text-white p-2 rounded hover:bg-gray-800 transition-colors duration-200"><Download size={16}/> Export</button>
                    </div>
                </div>
                 <hr className="my-4 border-gray-200"/>
                <div className="flex flex-wrap items-center gap-4">
                     <div className="flex items-center gap-2">
                        <button onClick={handleAddRegion} className="bg-black text-white p-2 rounded hover:bg-gray-800 transition-colors duration-200">Add Region</button>
                        <button onClick={() => handleRemove({ regionIdx: selectedRegionIndex })} disabled={selectedRegionIndex === null} className="bg-gray-200 text-black p-2 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-200">Delete Region</button>
                    </div>
                     <div className="flex items-center gap-2">
                        <button onClick={handleAddLocation} disabled={selectedRegionIndex === null} className="bg-black text-white p-2 rounded hover:bg-gray-800 disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-200">Add Location</button>
                        <button onClick={handleAddDevice} disabled={!selectedPath || selectedPath.deviceIdx !== undefined} className="bg-black text-white p-2 rounded hover:bg-gray-800 disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-200">Add Device</button>
                    </div>
                     <div className="flex items-center gap-2">
                        <button onClick={handleEditSelected} disabled={!selectedPath} className="bg-gray-200 text-black p-2 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-200">Edit Entry</button>
                        <button onClick={() => handleRemove(selectedPath)} disabled={!selectedPath} className="bg-gray-200 text-black p-2 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-200">Remove Entry</button>
                    </div>
                     <div className="flex-grow flex items-center gap-4 justify-end">
                          <div className="flex">
                              <input type="text" value={globalSearchQuery} onChange={e => setGlobalSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch(globalSearchQuery, 'global')} placeholder="Global Search..." className="w-48 p-2 border border-gray-300 bg-white rounded-l-md focus:ring-black focus:border-black" />
                              <button onClick={() => handleSearch(globalSearchQuery, 'global')} className="bg-gray-800 text-white p-2 rounded-r-md hover:bg-black"><Search size={20}/></button>
                          </div>
                           <div className="flex">
                              <select value={searchField} onChange={e => setSearchField(e.target.value)} className="p-2 border border-r-0 border-gray-300 rounded-l-md bg-gray-50 focus:ring-black focus:border-black">
                                  <option value="ip">IP</option>
                                  <option value="location">Location</option>
                                  <option value="type">Name/Type</option>
                              </select>
                              <input type="text" value={specificSearchQuery} onChange={e => setSpecificSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch(specificSearchQuery, searchField)} placeholder="Search in Region..." className="w-48 p-2 border border-gray-300 bg-white focus:ring-black focus:border-black" />
                              <button onClick={() => handleSearch(specificSearchQuery, searchField)} className="bg-gray-800 text-white p-2 rounded-r-md hover:bg-black"><Search size={20}/></button>
                          </div>
                    </div>
                </div>
            </header>

            <main className="flex-grow p-6 flex flex-col">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-grow overflow-y-auto">
                    {isLoading ? <div className="p-10 text-center text-gray-500">Loading...</div> : <DataTable region={selectedRegion} onSelect={setSelectedPath} selectedPath={selectedPath} />}
                </div>
            </main>
        </div>
    );
}

export default App;