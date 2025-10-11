const fs = require('fs');
const path = require('path');

// 读取 banks.json 文件
const banksConfigPath = path.join(__dirname, 'config', 'banks.json');
const banksData = JSON.parse(fs.readFileSync(banksConfigPath, 'utf8'));

console.log('=== 详细测试 banks.json 文件 ===\n');

// 测试 1: 验证 JSON 语法正确性
console.log('1. JSON 语法验证:');
try {
    JSON.parse(fs.readFileSync(banksConfigPath, 'utf8'));
    console.log('   ✅ JSON 语法正确');
} catch (error) {
    console.log('   ❌ JSON 语法错误:', error.message);
}

// 测试 2: 验证所有必需字段
console.log('\n2. 验证所有银行的必需字段:');
const requiredFields = ['id', 'name', 'type', 'isThirdParty', 'dailyLimit', 'currencies', 'reachableBanks'];
let allFieldsValid = true;

Object.entries(banksData).forEach(([bankName, bank]) => {
    console.log(`\n   ${bankName}:`);
    requiredFields.forEach(field => {
        const hasField = bank.hasOwnProperty(field);
        console.log(`     - ${field}: ${hasField ? '✅' : '❌ 缺失'}`);
        if (!hasField) allFieldsValid = false;
    });
});

// 测试 3: 验证 ID 唯一性
console.log('\n3. 验证银行 ID 唯一性:');
const bankIds = Object.values(banksData).map(bank => bank.id);
const uniqueIds = [...new Set(bankIds)];
const idsUnique = bankIds.length === uniqueIds.length;
console.log(`   - 总银行数: ${bankIds.length}`);
console.log(`   - 唯一 ID 数: ${uniqueIds.length}`);
console.log(`   - ID 唯一性: ${idsUnique ? '✅' : '❌ 存在重复 ID'}`);

// 测试 4: 验证 reachableBanks 连接的有效性
console.log('\n4. 验证银行连接的有效性:');
let allConnectionsValid = true;

Object.entries(banksData).forEach(([sourceBankName, sourceBank]) => {
    if (sourceBank.reachableBanks && sourceBank.reachableBanks.length > 0) {
        sourceBank.reachableBanks.forEach(connection => {
            // 检查目标银行是否存在
            const targetBank = Object.values(banksData).find(bank => bank.id === connection.id);
            if (!targetBank) {
                console.log(`   ❌ ${sourceBankName} -> ID ${connection.id}: 目标银行不存在`);
                allConnectionsValid = false;
            } else if (targetBank.name !== connection.bankName) {
                console.log(`   ❌ ${sourceBankName} -> ${targetBank.name}: 银行名称不一致`);
                allConnectionsValid = false;
            }
        });
    }
});

if (allConnectionsValid) {
    console.log('   ✅ 所有银行连接有效');
}

// 测试 5: 验证通道类型
console.log('\n5. 验证转账通道类型:');
const validChannels = ['SWIFT', '第三方支付'];
let allChannelsValid = true;

Object.entries(banksData).forEach(([bankName, bank]) => {
    if (bank.reachableBanks) {
        bank.reachableBanks.forEach(connection => {
            if (!validChannels.includes(connection.channel)) {
                console.log(`   ❌ ${bankName} -> ${connection.bankName}: 无效通道类型 "${connection.channel}"`);
                allChannelsValid = false;
            }
        });
    }
});

if (allChannelsValid) {
    console.log('   ✅ 所有通道类型有效');
}

// 测试 6: 验证费用结构
console.log('\n6. 验证费用结构:');
let allFeesValid = true;

Object.entries(banksData).forEach(([bankName, bank]) => {
    if (bank.reachableBanks) {
        bank.reachableBanks.forEach(connection => {
            const transferFee = connection.transferFee;
            const arrivalFee = connection.arrivalFee;
            
            if (!transferFee || typeof transferFee.fixed !== 'number' || typeof transferFee.percentage !== 'number') {
                console.log(`   ❌ ${bankName} -> ${connection.bankName}: 转账费用结构无效`);
                allFeesValid = false;
            }
            
            if (!arrivalFee || typeof arrivalFee.fixed !== 'number' || typeof arrivalFee.percentage !== 'number') {
                console.log(`   ❌ ${bankName} -> ${connection.bankName}: 到账费用结构无效`);
                allFeesValid = false;
            }
        });
    }
});

if (allFeesValid) {
    console.log('   ✅ 所有费用结构有效');
}

// 总结
console.log('\n=== 详细测试结果总结 ===');
const overallSuccess = allFieldsValid && idsUnique && allConnectionsValid && allChannelsValid && allFeesValid;

console.log('1. JSON 语法: ✅ 通过');
console.log(`2. 必需字段: ${allFieldsValid ? '✅ 通过' : '❌ 失败'}`);
console.log(`3. ID 唯一性: ${idsUnique ? '✅ 通过' : '❌ 失败'}`);
console.log(`4. 连接有效性: ${allConnectionsValid ? '✅ 通过' : '❌ 失败'}`);
console.log(`5. 通道类型: ${allChannelsValid ? '✅ 通过' : '❌ 失败'}`);
console.log(`6. 费用结构: ${allFeesValid ? '✅ 通过' : '❌ 失败'}`);

console.log(`\n总体结果: ${overallSuccess ? '✅ 所有详细测试通过' : '❌ 存在错误'}`);

if (overallSuccess) {
    console.log('\n🎉 banks.json 文件重构完全成功！结构正确且数据完整。');
} else {
    console.log('\n⚠️ 请检查并修复上述错误。');
}

// 显示统计信息
console.log('\n📊 统计信息:');
console.log(`- 总银行数: ${Object.keys(banksData).length}`);
console.log(`- 总连接数: ${Object.values(banksData).reduce((sum, bank) => sum + (bank.reachableBanks ? bank.reachableBanks.length : 0), 0)}`);
console.log(`- 平均每个银行连接数: ${(Object.values(banksData).reduce((sum, bank) => sum + (bank.reachableBanks ? bank.reachableBanks.length : 0), 0) / Object.keys(banksData).length).toFixed(1)}`);