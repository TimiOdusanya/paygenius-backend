import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { TransferController } from '../controllers/transferController';

const router = Router();

router.use(authenticate);

router.get('/lookup', TransferController.lookup);
router.get('/resolve', TransferController.resolve);
router.get('/beneficiaries', TransferController.listBeneficiaries);
router.post('/beneficiaries', TransferController.createBeneficiary);
router.delete('/beneficiaries/:id', TransferController.deleteBeneficiary);
router.post('/', TransferController.send);
router.get('/:id', TransferController.getOne);

export default router;
