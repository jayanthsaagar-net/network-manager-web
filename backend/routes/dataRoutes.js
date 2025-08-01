import express from 'express';
import multer from 'multer';
// --- FIX: Renamed searchByIp to a more generic 'search' function ---
import { getAllData, updateAllData, importFromExcel, exportToExcel, search } from '../controllers/dataController.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/', getAllData);
router.post('/', updateAllData);
router.post('/import', upload.single('file'), importFromExcel);
router.get('/export', exportToExcel);
// --- FIX: Route now points to the new global search function ---
router.get('/search', search);

export default router;