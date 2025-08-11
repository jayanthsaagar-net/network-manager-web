import express from 'express';
import multer from 'multer';
// --- FIX: Added getSuggestions to the import ---
import { getAllData, updateAllData, importFromExcel, exportToExcel, search, checkAvailableSerials, getSuggestions } from '../controllers/dataController.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/', getAllData);
router.post('/', updateAllData);
router.post('/import', upload.single('file'), importFromExcel);
router.get('/export', exportToExcel);
router.get('/search', search);
router.post('/check-serials', upload.single('file'), checkAvailableSerials);
// --- FIX: Added a new route for search suggestions ---
router.get('/suggestions', getSuggestions);

export default router;