import Region from '../models/Region.js';
import { parseExcelData as parseExcelDataUtil } from '../utils/excelParser.js';
import xlsx from 'xlsx';

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

        // --- FIX: If a regionName is provided, start by matching that region ---
        if (regionName) {
            pipeline.push({ $match: { name: regionName } });
        }

        pipeline.push({ $unwind: "$locations" });
        pipeline.push({ $unwind: "$locations.devices" });

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
        
        pipeline.push({ $match: searchMatch });
        
        pipeline.push({
            $project: {
                _id: 0,
                regionName: "$name",
                locationName: "$locations.name",
                device: "$locations.devices"
            }
        });
        
        const results = await Region.aggregate(pipeline);

        res.status(200).json(results);
    } catch (error) {
        console.error("Search Error:", error);
        res.status(500).json({ message: "An error occurred during search", error: error.message });
    }
};