const fs = require('fs');
const path = require('path');

// 读取 banks.json 文件
const banksConfigPath = path.join(__dirname, 'config', 'banks.json');
const banksData = JSON.parse(fs.readFileSync(banksConfigPath, 'utf8'));

console.log('=== 测试 banks.json 文件结构 ===\n');

// 测试 1: 验证是否为对象格式（非数组）
console.log('1. 验证是否为对象格式:');
console.log(`   - 类型: ${Array.isArray(banksData) ? '数组 ❌' : '对象 ✅'}`);
console.log(`   - 银行数量: ${Object.keys(banksData).length}`);

// 测试 2: 验证 key 是否为银行名称
console.log('\n2. 验证 key 是否为银行名称:');
const bankNames = Object.keys(banksData);
console.log('   银行名称列表:');
bankNames.forEach(name => {
    console.log(`   - ${name}`);
});

// 测试 3: 验证每个银行的 ID 是否为纯数字
console.log('\n3. 验证银行 ID 是否为纯数字:');
let allIdsValid = true;
bankNames.forEach(bankName => {
    const bank = banksData[bankName];
    const isValidId = typeof bank.id === 'number' && Number.isInteger(bank.id);
    console.log(`   - ${bankName}: ID = ${bank.id}, ${isValidId ? '✅' : '❌'}`);
    if (!isValidId) allIdsValid = false;
});

// 测试 4: 验证 reachableBanks 中是否包含银行名称
console.log('\n4. 验证 reachableBanks 中是否包含银行名称:');
let allReachableBanksValid = true;
bankNames.forEach(bankName => {
    const bank = banksData[bankName];
    if (bank.reachableBanks && bank.reachableBanks.length > 0) {
        console.log(`   ${bankName} 的可到达银行:`);
        bank.reachableBanks.forEach(reachableBank => {
            const hasBankName = reachableBank.bankName && typeof reachableBank.bankName === 'string';
            const hasBankId = typeof reachableBank.id === 'number';
            console.log(`     - 目标银行: ${reachableBank.bankName || '未知'}, ID: ${reachableBank.id}, ${hasBankName && hasBankId ? '✅' : '❌'}`);
            if (!hasBankName || !hasBankId) allReachableBanksValid = false;
        });
    } else {
        console.log(`   ${bankName}: 无可到达银行`);
    }
});

// 测试 5: 验证数据一致性
console.log('\n5. 验证数据一致性:');
let consistencyValid = true;
bankNames.forEach(bankName => {
    const bank = banksData[bankName];
    
    // 验证银行名称一致性
    if (bank.name !== bankName) {
        console.log(`   ❌ ${bankName}: 配置中的名称 "${bank.name}" 与 key 不一致`);
        consistencyValid = false;
    }
    
    // 验证 reachableBanks 中的银行是否存在
    if (bank.reachableBanks) {
        bank.reachableBanks.forEach(reachableBank => {
            const targetBankName = Object.keys(banksData).find(name => 
                banksData[name].id === reachableBank.id
            );
            if (!targetBankName) {
                console.log(`   ❌ ${bankName}: 可到达银行 ID ${reachableBank.id} 不存在`);
                consistencyValid = false;
            } else if (targetBankName !== reachableBank.bankName) {
                console.log(`   ❌ ${bankName}: 可到达银行名称不一致，配置中为 "${reachableBank.bankName}"，实际应为 "${targetBankName}"`);
                consistencyValid = false;
            }
        });
    }
});

// 总结
console.log('\n=== 测试结果总结 ===');
console.log(`1. 对象格式: ${Array.isArray(banksData) ? '失败' : '通过'}`);
console.log(`2. 银行 ID 格式: ${allIdsValid ? '通过' : '失败'}`);
console.log(`3. reachableBanks 包含银行名称: ${allReachableBanksValid ? '通过' : '失败'}`);
console.log(`4. 数据一致性: ${consistencyValid ? '通过' : '失败'}`);

const overallSuccess = !Array.isArray(banksData) && allIdsValid && allReachableBanksValid && consistencyValid;
console.log(`\n总体结果: ${overallSuccess ? '✅ 所有测试通过' : '❌ 存在错误'}`);

if (overallSuccess) {
    console.log('\n✅ banks.json 文件结构重构成功！');
} else {
    console.log('\n❌ 请检查并修复上述错误。');
}