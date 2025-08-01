// Location: /backend/utils/excelParser.js
// ===================================================================================
import xlsx from 'xlsx';

function findHeadersAndMap(rows) {
    const headerKeywords = {
        s_no: ['s.no.', 's.no'],
        location: ['location'],
        interface: ['interface'],
        ip_address: ['ip address'],
        description: ['description'],
        status: ['status'],
    };

    for (let i = 0; i < Math.min(rows.length, 15); i++) {
        const row = rows[i].map(cell => String(cell).toLowerCase().trim());
        const foundCols = {};
        let headersFound = 0;

        Object.keys(headerKeywords).forEach(key => {
            const keywords = headerKeywords[key];
            const colIndex = row.findIndex(header => keywords.includes(header));
            if (colIndex !== -1) {
                foundCols[key] = colIndex;
                headersFound++;
            }
        });

        if (headersFound >= 3) {
            return { headerRowIndex: i, columnMap: foundCols };
        }
    }
    return null;
}

function parseStructuredSheet(rows) {
    const headerInfo = findHeadersAndMap(rows);
    if (!headerInfo) {
        return [];
    }

    const { headerRowIndex, columnMap } = headerInfo;
    const locations = [];
    let currentLocation = null;

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i].map(cell => String(cell).trim());
        if (row.every(cell => cell === '')) continue;

        const isNewLocation = row[columnMap.s_no] && /^\d+$/.test(row[columnMap.s_no]);
        
        if (isNewLocation && row[columnMap.location]) {
            currentLocation = { name: row[columnMap.location], network_id: "", devices: [] };
            locations.push(currentLocation);
        }

        if (!currentLocation) continue;

        const interfaceType = row[columnMap.interface];
        const ipAddress = row[columnMap.ip_address];
        const description = row[columnMap.description];
        const status = row[columnMap.status] || '';

        if (!interfaceType) continue;

        if (interfaceType.toLowerCase().includes('network id')) {
            currentLocation.network_id = ipAddress;
        } else {
            currentLocation.devices.push({
                type: interfaceType, ip: ipAddress, description, status, sub_devices: []
            });
        }
    }
    return locations;
}

function parseSimpleSheet(rows, sheetName) {
    const locations = [];
    let currentDeviceGroup = null;

    rows.forEach(row => {
        const rowData = row.map(cell => String(cell).trim());
        if (rowData.every(cell => cell === '')) return;

        if (rowData[0] && !rowData[1] && !rowData[2]) {
             currentDeviceGroup = { name: rowData[0], network_id: "", devices: [] };
             locations.push(currentDeviceGroup);
        } else if (currentDeviceGroup && rowData[1] && rowData[2]) {
            currentDeviceGroup.devices.push({
                type: rowData[1], ip: rowData[2], description: rowData[3] || '', status: '', sub_devices: []
            });
        }
    });
    
    if (locations.length > 0) return locations;

    const singleLocation = { name: sheetName, network_id: "", devices: [] };
     rows.forEach(row => {
         const rowData = row.map(cell => String(cell).trim());
         if (rowData[1] && rowData[2]) {
             singleLocation.devices.push({
                 type: rowData[1], ip: rowData[2], description: rowData[3] || '', status: '', sub_devices: []
             });
         }
     });
     return [singleLocation];
}

export function parseExcelData(xls) {
    const allRegions = [];
    for (const sheetName of xls.SheetNames) {
        const ws = xls.Sheets[sheetName];
        if (!ws) continue;
        const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
        
        const region = { name: sheetName.trim(), locations: [] };
        
        const structuredLocations = parseStructuredSheet(rows);
        
        if (structuredLocations.length > 0) {
            region.locations = structuredLocations;
        } else {
            region.locations = parseSimpleSheet(rows, sheetName);
        }

        if (region.locations.length > 0) {
            allRegions.push(region);
        }
    }
    return allRegions;
}


// ===================================================================================