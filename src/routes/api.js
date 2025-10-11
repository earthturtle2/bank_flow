const express = require('express');
const router = express.Router();

// 初始化服务
const banks = require('../../config/banks.json');
const FileSystemPersistence = require('../persistence/FileSystemPersistence');
const TransferService = require('../services/TransferService');

const persistence = new FileSystemPersistence();
const transferService = new TransferService(persistence, banks);

// 获取所有银行列表
router.get('/banks', (req, res) => {
  try {
    res.json({
      success: true,
      data: banks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取可用转账路线
router.get('/routes', async (req, res) => {
  try {
    const { currency, amount, fromBankId, toBankId } = req.query;
    
    if (!currency || !amount || !fromBankId || !toBankId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：currency, amount, fromBankId, toBankId'
      });
    }
    
    const routes = await transferService.getAvailableRoutes(
      currency,
      parseFloat(amount),
      fromBankId,
      toBankId
    );
    
    res.json({
      success: true,
      data: routes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 创建转账任务
router.post('/tasks', async (req, res) => {
  try {
    const { currency, amount, fromBankId, toBankId, route } = req.body;
    
    if (!currency || !amount || !fromBankId || !toBankId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：currency, amount, fromBankId, toBankId'
      });
    }
    
    const task = await transferService.createTransferTask(
      currency,
      parseFloat(amount),
      fromBankId,
      toBankId,
      route
    );
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取所有任务
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await persistence.getAllTasks();
    
    // 补充银行信息
    const enrichedTasks = tasks.map(task => {
      const enriched = { ...task };
      // 补充银行信息 - 将bank_001格式的ID转换为数字ID
      const fromBankId = task.fromBankId.startsWith('bank_') ? parseInt(task.fromBankId.replace('bank_', '')) : parseInt(task.fromBankId);
      const toBankId = task.toBankId.startsWith('bank_') ? parseInt(task.toBankId.replace('bank_', '')) : parseInt(task.toBankId);
      enriched.fromBank = Object.values(banks).find(b => b.id === fromBankId);
      enriched.toBank = Object.values(banks).find(b => b.id === toBankId);
      return enriched;
    });
    
    res.json({
      success: true,
      data: enrichedTasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取任务详情
router.get('/tasks/:id', async (req, res) => {
  try {
    const task = await transferService.getTaskDetails(req.params.id);
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// 开始转账
router.post('/tasks/:id/start', async (req, res) => {
  try {
    const task = await transferService.startTransfer(req.params.id);
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// 确认资金到账
router.post('/tasks/:id/confirm', async (req, res) => {
  try {
    const { actualAmount, reason } = req.body;
    
    if (!actualAmount) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：actualAmount'
      });
    }
    
    const task = await transferService.confirmArrival(
      req.params.id,
      parseFloat(actualAmount),
      reason || ''
    );
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// 发送下一步资金
router.post('/tasks/:id/next', async (req, res) => {
  try {
    const task = await transferService.sendNextStep(req.params.id);
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// 取消任务
router.post('/tasks/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：reason'
      });
    }
    
    const task = await transferService.cancelTask(req.params.id, reason);
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;