import Region from '../models/Region.js';
import { parseExcelData as parseExcelDataUtil } from '../utils/excelParser.js';
import xlsx from 'xlsx';

// Helper function to parse the serials file
const parseSerialsFile = (xls) => {
    const serialsByRegion = {};
    for (const sheetName of xls.SheetNames) {
        const ws = xls.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const regionName = sheetName.trim();
        serialsByRegion[regionName] = new Set();
        
        let serialIpColumn = -1;
        // Find the "Serial ip" column
        if (rows.length > 0) {
            const headerRow = rows.find(r => r.some(cell => String(cell).toLowerCase().includes('serial ip')));
            if (headerRow) {
                serialIpColumn = headerRow.findIndex(cell => String(cell).toLowerCase().includes('serial ip'));
            }
        }
        
        rows.forEach(row => {
            let cell = '';
            if (serialIpColumn !== -1) {
                cell = String(row[serialIpColumn] || '').trim();
            } else {
                // Fallback for less structured sheets
                for (let i = 1; i < 15; i++) {
                    const tempCell = String(row[i] || '').trim();
                    if (tempCell.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
                        cell = tempCell;
                        break;
                    }
                }
            }

            if (cell.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
                serialsByRegion[regionName].add(cell);
            }
        });
    }
    return serialsByRegion;
};

export const getAllData = async (req, res) => {
    try {
        const data = await Region.find();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching data', error: error.message });
    }
};

export const updateAllData = async (req, res) => {
    try {
        await Region.deleteMany({});
        if (req.body && req.body.length > 0) {
            await Region.insertMany(req.body);
        }
        res.status(201).json({ message: "Data saved successfully." });
    } catch (error) {
        console.error("Save Error:", error.message);
        res.status(500).json({ message: 'Error saving data', error: error.message });
    }
};

export const importFromExcel = async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const parsedData = parseExcelDataUtil(workbook);
        
        if (!parsedData || parsedData.length === 0) {
            return res.status(400).json({ message: 'Could not extract any valid data from the Excel file. Please check the format.' });
        }
        
        await Region.deleteMany({});
        await Region.insertMany(parsedData);
        
        const freshData = await Region.find();
        res.status(200).json(freshData);
    } catch (error) {
        console.error("Import Error:", error);
        res.status(500).json({ message: 'Error processing Excel file', error: error.message });
    }
};

export const exportToExcel = async (req, res) => {
    try {
        const regions = await Region.find().lean();
        const workbook = xlsx.utils.book_new();

        regions.forEach(region => {
            const sheetData = [];
            const headers = ["S.No.", "Location", "Interface", "IP Address", "Description", "Status"];
            sheetData.push(headers);
            
            region.locations.forEach((location, locIndex) => {
                sheetData.push([locIndex + 1, location.name, 'Network ID', location.network_id, '', '']);
                location.devices.forEach(device => {
                    sheetData.push(['', '', device.type, device.ip, device.description, device.status]);
                    if (device.sub_devices && device.sub_devices.length > 0) {
                        device.sub_devices.forEach(sub => {
                             sheetData.push(['', '', `  - ${sub.name}`, sub.ip, '', '']);
                        });
                    }
                });
                sheetData.push([]);
            });
            
            const worksheet = xlsx.utils.aoa_to_sheet(sheetData);
            xlsx.utils.book_append_sheet(workbook, worksheet, region.name.substring(0, 31));
        });

        const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
        res.setHeader('Content-Disposition', 'attachment; filename="network_infrastructure.xlsx"');
        res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        res.status(500).json({ message: 'Error exporting to Excel', error: error.message });
    }
};

export const search = async (req, res) => {
    try {
        const { term, field, regionName } = req.query;
        if (!term) {
            return res.status(400).json({ message: "Search term query parameter is required." });
        }

        const searchRegex = { $regex: term.trim(), $options: 'i' };
        
        let pipeline = [];

        if (regionName && field !== 'global') {
            pipeline.push({ $match: { name: regionName } });
        }

        let searchMatch = {};
        if (field === 'location') {
            searchMatch = { "locations.name": searchRegex };
        } else if (field === 'ip') {
            searchMatch = { "locations.devices.ip": searchRegex };
        } else if (field === 'type') {
            searchMatch = { "locations.devices.type": searchRegex };
        } else { // Global search
            searchMatch = {
                $or: [
                    { "name": searchRegex }, 
                    { "locations.name": searchRegex },
                    { "locations.devices.type": searchRegex },
                    { "locations.devices.ip": searchRegex },
                    { "locations.devices.description": searchRegex },
                    { "locations.devices.status": searchRegex }
                ]
            };
        }
        
        pipeline.push(
            { $unwind: "$locations" },
            { $unwind: "$locations.devices" },
            { $match: searchMatch },
            {
                $project: {
                    _id: 0,
                    regionName: "$name",
                    locationName: "$locations.name",
                    device: "$locations.devices"
                }
            }
        );
        
        const results = await Region.aggregate(pipeline);

        res.status(200).json(results);
    } catch (error) {
        console.error("Search Error:", error);
        res.status(500).json({ message: "An error occurred during search", error: error.message });
    }
};

export const checkAvailableSerials = async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No serials file uploaded.');
    }
    try {
        const xls = xlsx.read(req.file.buffer, { type: 'buffer' });
        const allPossibleSerials = parseSerialsFile(xls);
        const regions = await Region.find();
        
        const usedIps = new Set();
        regions.forEach(region => {
            region.locations.forEach(location => {
                location.devices.forEach(device => {
                    if (device.ip) {
                        const ipOnly = device.ip.split(' ')[0].split('/')[0];
                        usedIps.add(ipOnly);
                    }
                });
            });
        });

        const availabilityResults = {};
        for (const regionName in allPossibleSerials) {
            if (allPossibleSerials.hasOwnProperty(regionName)) {
                const allSerials = allPossibleSerials[regionName];
                
                availabilityResults[regionName] = Array.from(allSerials)
                    .map(ip => ({
                        ip,
                        status: usedIps.has(ip) ? "Used" : "Unused"
                    }))
                    .filter(serial => serial.status === "Unused"); // Only return unused IPs
            }
        }

        res.status(200).json(availabilityResults);

    } catch (error) {
        console.error("Check Serials Error:", error);
        res.status(500).json({ message: "Error checking serials", error: error.message });
    }
};

export const getSuggestions = async (req, res) => {
    try {
        const { term, field, regionName } = req.query;
        if (!term) {
            return res.json([]);
        }

        const searchRegex = { $regex: `^${term.trim()}`, $options: 'i' };
        let pipeline = [];

        if (regionName && field !== 'global') {
            pipeline.push({ $match: { name: regionName } });
        }

        let groupField = '';
        if (field === 'location') {
            pipeline.push({ $unwind: "$locations" });
            pipeline.push({ $match: { "locations.name": searchRegex } });
            groupField = "$locations.name";
        } else if (field === 'ip') {
            pipeline.push({ $unwind: "$locations" }, { $unwind: "$locations.devices" });
            pipeline.push({ $match: { "locations.devices.ip": searchRegex } });
            groupField = "$locations.devices.ip";
        } else if (field === 'type') {
            pipeline.push({ $unwind: "$locations" }, { $unwind: "$locations.devices" });
            pipeline.push({ $match: { "locations.devices.type": searchRegex } });
            groupField = "$locations.devices.type";
        } else { // Global
             pipeline.push(
                { $unwind: "$locations" },
                { $unwind: "$locations.devices" },
                {
                    $match: {
                        $or: [
                            { "name": searchRegex },
                            { "locations.name": searchRegex },
                            { "locations.devices.type": searchRegex },
                            { "locations.devices.ip": searchRegex },
                        ]
                    }
                }
            );
            const regions = await Region.distinct('name', { name: searchRegex }).limit(5);
            const locations = await Region.distinct('locations.name', { 'locations.name': searchRegex }).limit(5);
            const ips = await Region.distinct('locations.devices.ip', { 'locations.devices.ip': searchRegex }).limit(5);
            const types = await Region.distinct('locations.devices.type', { 'locations.devices.type': searchRegex }).limit(5);
            const suggestions = [...new Set([...regions, ...locations, ...ips, ...types])];
            return res.json(suggestions.slice(0, 10));
        }

        pipeline.push({ $group: { _id: groupField } });
        pipeline.push({ $limit: 10 });

        const results = await Region.aggregate(pipeline);
        res.json(results.map(r => r._id));

    } catch (error) {
        console.error("Suggestion Error:", error);
        res.status(500).json({ message: "An error occurred while fetching suggestions" });
    }
};