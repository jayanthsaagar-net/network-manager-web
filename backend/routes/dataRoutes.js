import express from 'express';
import multer from 'multer';
// --- FIX: Added the new controller function ---
import { getAllData, updateAllData, importFromExcel, exportToExcel, search, checkAvailableSerials } from '../controllers/dataController.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/', getAllData);
router.post('/', updateAllData);
router.post('/import', upload.single('file'), importFromExcel);
router.get('/export', exportToExcel);
router.get('/search', search);

// --- FIX: Added a new route for checking serials ---
router.post('/check-serials', upload.single('file'), checkAvailableSerials);

export default router;