import mongoose from 'mongoose';

const SubDeviceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    ip: { type: String, required: true }
});

const DeviceSchema = new mongoose.Schema({
    type: { type: String, required: true },
    ip: { type: String, default: '' },
    description: { type: String, default: '' },
    status: { type: String, default: '' },
    sub_devices: [SubDeviceSchema]
});

const LocationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    network_id: { type: String, default: '' },
    devices: [DeviceSchema],
    // --- FIX: Added a field to store available serial IPs ---
    available_serials: { type: [String], default: [] }
});

const RegionSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    locations: [LocationSchema]
});

const Region = mongoose.model('Region', RegionSchema);
export default Region;