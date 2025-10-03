const { v4: uuidv4 } = require('uuid');

// 导入必要的模块
const FileSystemPersistence = require('./src/persistence/FileSystemPersistence');
const TransferService = require('./src/services/TransferService');
const banks = require('./config/banks.json');

// 初始化服务
const persistence = new FileSystemPersistence();
const transferService = new TransferService(persistence, banks);

// 测试颜色输出
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
    console.log(`${colors.cyan}${step}${colors.reset} - ${message}`);
}

function logSuccess(message) {
    console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function logError(message) {
    console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

function logWarning(message) {
    console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

// 测试转账任务完整流程
async function testTransferFlow() {
    log('\n' + '='.repeat(60), 'bright');
    log('开始测试银行转账追踪系统完整流程', 'bright');
    log('='.repeat(60), 'bright');
    
    try {
        // 测试用例1: 直接转账（一步完成）
        await testDirectTransfer();
        
        // 测试用例2: 多步转账（通过中间银行）
        await testMultiStepTransfer();
        
        // 测试用例3: 取消转账任务
        await testCancelTransfer();
        
        // 测试用例4: 金额不一致处理
        await testAmountMismatch();
        
        log('\n' + '='.repeat(60), 'bright');
        log('所有测试用例执行完成！', 'green');
        log('='.repeat(60), 'bright');
        
    } catch (error) {
        logError(`测试过程中出现错误: ${error.message}`);
        console.error(error);
    }
}

// 测试用例1: 直接转账
async function testDirectTransfer() {
    log('\n' + '-'.repeat(40), 'blue');
    log('测试用例1: 直接转账（一步完成）', 'blue');
    log('-'.repeat(40), 'blue');
    
    const currency = 'CNY';
    const amount = 5000;
    const fromBankId = 'bank_001'; // 工商银行
    const toBankId = 'bank_002';   // 建设银行
    
    logStep('1.1', '创建直接转账任务');
    const task = await transferService.createTransferTask(currency, amount, fromBankId, toBankId);
    logSuccess(`任务创建成功！任务ID: ${task.id}`);
    logSuccess(`转账路线: ${task.route.join(' → ')}`);
    logSuccess(`总费用: ${task.totalFees} ${currency}`);
    logSuccess(`净到账金额: ${task.netAmount} ${currency}`);
    
    logStep('1.2', '开始转账');
    const startedTask = await transferService.startTransfer(task.id);
    logSuccess(`转账已开始，当前步骤: ${startedTask.currentStep + 1}/${startedTask.steps.length}`);
    
    logStep('1.3', '确认资金到账');
    const actualAmount = amount - task.totalFees; // 实际到账金额
    const confirmedTask = await transferService.confirmArrival(task.id, actualAmount, '金额一致');
    logSuccess(`资金到账确认成功！`);
    logSuccess(`实际到账金额: ${actualAmount} ${currency}`);
    logSuccess(`任务状态: ${confirmedTask.status}`);
    
    // 验证任务完成
    if (confirmedTask.status === 'completed') {
        logSuccess('直接转账测试通过！');
    } else {
        logError('直接转账测试失败：任务状态不正确');
    }
}

// 测试用例2: 多步转账
async function testMultiStepTransfer() {
    log('\n' + '-'.repeat(40), 'blue');
    log('测试用例2: 多步转账（通过中间银行）', 'blue');
    log('-'.repeat(40), 'blue');
    
    const currency = 'CNY';
    const amount = 8000;
    const fromBankId = 'bank_001'; // 工商银行
    const toBankId = 'bank_004';   // 招商银行（需要通过中间银行）
    
    logStep('2.1', '创建多步转账任务');
    const task = await transferService.createTransferTask(currency, amount, fromBankId, toBankId);
    logSuccess(`任务创建成功！任务ID: ${task.id}`);
    logSuccess(`转账路线: ${task.route.join(' → ')}`);
    logSuccess(`总步骤数: ${task.steps.length}`);
    
    logStep('2.2', '开始转账（第一步）');
    const startedTask = await transferService.startTransfer(task.id);
    logSuccess(`第一步转账已开始`);
    
    logStep('2.3', '确认第一步资金到账');
    const step1ActualAmount = amount - task.steps[0].totalStepFee;
    const step1Confirmed = await transferService.confirmArrival(task.id, step1ActualAmount, '第一步金额一致');
    logSuccess(`第一步资金到账确认成功`);
    logSuccess(`当前步骤: ${step1Confirmed.currentStep + 1}/${step1Confirmed.steps.length}`);
    
    // 检查是否还有未完成的步骤
    if (step1Confirmed.currentStep < step1Confirmed.steps.length) {
        logStep('2.4', '发送第二步资金');
        const step2Sent = await transferService.sendNextStep(task.id);
        logSuccess(`第二步资金已发送`);
        
        logStep('2.5', '确认第二步资金到账');
        const step2ActualAmount = step1ActualAmount - task.steps[1].totalStepFee;
        const finalTask = await transferService.confirmArrival(task.id, step2ActualAmount, '第二步金额一致');
        logSuccess(`第二步资金到账确认成功`);
        
        if (finalTask.status === 'completed') {
            logSuccess('多步转账测试通过！');
        } else {
            logError('多步转账测试失败：任务状态不正确');
        }
    } else {
        logWarning('多步转账路线只有一步，跳过后续步骤测试');
    }
}

// 测试用例3: 取消转账任务
async function testCancelTransfer() {
    log('\n' + '-'.repeat(40), 'blue');
    log('测试用例3: 取消转账任务', 'blue');
    log('-'.repeat(40), 'blue');
    
    const currency = 'CNY';
    const amount = 3000;
    const fromBankId = 'bank_002'; // 建设银行
    const toBankId = 'bank_003';   // 中国银行
    
    logStep('3.1', '创建待取消的转账任务');
    const task = await transferService.createTransferTask(currency, amount, fromBankId, toBankId);
    logSuccess(`任务创建成功！任务ID: ${task.id}`);
    
    logStep('3.2', '取消转账任务');
    const cancelReason = '用户主动取消';
    const cancelledTask = await transferService.cancelTask(task.id, cancelReason);
    logSuccess(`任务取消成功！`);
    logSuccess(`取消原因: ${cancelledTask.cancellationReason}`);
    
    if (cancelledTask.status === 'cancelled') {
        logSuccess('取消转账测试通过！');
    } else {
        logError('取消转账测试失败：任务状态不正确');
    }
}

// 测试用例4: 金额不一致处理
async function testAmountMismatch() {
    log('\n' + '-'.repeat(40), 'blue');
    log('测试用例4: 金额不一致处理', 'blue');
    log('-'.repeat(40), 'blue');
    
    const currency = 'CNY';
    const amount = 2000;
    const fromBankId = 'bank_003'; // 中国银行
    const toBankId = 'bank_005';   // 支付宝
    
    logStep('4.1', '创建转账任务');
    const task = await transferService.createTransferTask(currency, amount, fromBankId, toBankId);
    logSuccess(`任务创建成功！任务ID: ${task.id}`);
    
    logStep('4.2', '开始转账');
    const startedTask = await transferService.startTransfer(task.id);
    logSuccess(`转账已开始`);
    
    logStep('4.3', '确认资金到账（金额不一致）');
    const expectedAmount = amount - task.totalFees;
    const actualAmount = expectedAmount - 10; // 模拟金额不一致
    const mismatchReason = '银行收取了额外手续费';
    
    const confirmedTask = await transferService.confirmArrival(task.id, actualAmount, mismatchReason);
    logSuccess(`资金到账确认成功（金额不一致）`);
    logSuccess(`预期金额: ${expectedAmount} ${currency}`);
    logSuccess(`实际金额: ${actualAmount} ${currency}`);
    logSuccess(`差异原因: ${mismatchReason}`);
    
    // 验证金额不一致信息被正确记录
    const step = confirmedTask.steps[0];
    if (step.actualAmount === actualAmount && step.amountMismatchReason === mismatchReason) {
        logSuccess('金额不一致处理测试通过！');
    } else {
        logError('金额不一致处理测试失败：金额信息记录不正确');
    }
}

// 辅助函数：显示所有任务
async function displayAllTasks() {
    log('\n' + '='.repeat(60), 'magenta');
    log('当前所有转账任务', 'magenta');
    log('='.repeat(60), 'magenta');
    
    try {
        const tasks = await persistence.getAllTasks();
        
        if (tasks.length === 0) {
            logWarning('暂无转账任务');
            return;
        }
        
        tasks.forEach((task, index) => {
            const statusColor = {
                'pending': 'yellow',
                'processing': 'blue',
                'completed': 'green',
                'cancelled': 'red'
            }[task.status] || 'reset';
            
            log(`\n任务 ${index + 1}:`, 'bright');
            log(`  ID: ${task.id}`, 'cyan');
            log(`  状态: ${task.status}`, statusColor);
            log(`  金额: ${task.amount} ${task.currency}`);
            log(`  路线: ${task.route.join(' → ')}`);
            log(`  当前步骤: ${task.currentStep + 1}/${task.steps.length}`);
            log(`  创建时间: ${new Date(task.createdAt).toLocaleString()}`);
            
            if (task.status === 'cancelled') {
                log(`  取消原因: ${task.cancellationReason}`, 'yellow');
            }
            
            if (task.status === 'completed') {
                log(`  总费用: ${task.totalFees} ${task.currency}`, 'green');
                log(`  净到账: ${task.netAmount} ${task.currency}`, 'green');
            }
        });
        
        log(`\n总计: ${tasks.length} 个任务`);
        
    } catch (error) {
        logError(`获取任务列表失败: ${error.message}`);
    }
}

// 主函数
async function main() {
    try {
        // 运行测试流程
        await testTransferFlow();
        
        // 显示所有任务
        await displayAllTasks();
        
        log('\n' + '='.repeat(60), 'bright');
        log('测试完成！', 'green');
        log('='.repeat(60), 'bright');
        
    } catch (error) {
        logError(`测试执行失败: ${error.message}`);
        console.error(error);
    }
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
    main().catch(error => {
        console.error('测试执行出错:', error);
        process.exit(1);
    });
}

module.exports = {
    testTransferFlow,
    testDirectTransfer,
    testMultiStepTransfer,
    testCancelTransfer,
    testAmountMismatch,
    displayAllTasks
};