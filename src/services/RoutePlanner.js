class RoutePlanner {
  constructor(banks) {
    this.banks = banks;
  }

  // 查找所有可能的转账路线
  findAllRoutes(fromBankId, toBankId, maxSteps = 3) {
    const routes = [];
    const visited = new Set();
    
    // 将字符串ID转换为数字进行比较
    const fromId = parseInt(fromBankId);
    const toId = parseInt(toBankId);
    
    const dfs = (currentBankId, path, totalFees, totalDuration) => {
      if (path.length > maxSteps) return;
      
      if (currentBankId === toId) {
        routes.push({
          path: [...path],
          totalFees: totalFees,
          totalDuration: totalDuration,
          steps: path.length - 1
        });
        return;
      }
      
      visited.add(currentBankId);
      
      const currentBank = Object.values(this.banks).find(b => b.id === currentBankId);
      if (!currentBank) return;
      
      for (const connection of currentBank.reachableBanks) {
        if (!visited.has(connection.id)) {
          const nextBank = Object.values(this.banks).find(b => b.id === connection.id);
          if (!nextBank) continue;
          
          // 计算这一步的费用和时长
          const stepFees = connection.transferFee.fixed + connection.arrivalFee.fixed;
          const duration = this.parseDuration(connection.expectedDuration);
          
          dfs(
            connection.id,
            [...path, connection.id],
            totalFees + stepFees,
            totalDuration + duration
          );
        }
      }
      
      visited.delete(currentBankId);
    };
    
    dfs(fromId, [fromId], 0, 0);
    
    // 按步骤数、费用、时长排序
    return routes.sort((a, b) => {
      if (a.steps !== b.steps) return a.steps - b.steps;
      if (a.totalFees !== b.totalFees) return a.totalFees - b.totalFees;
      return a.totalDuration - b.totalDuration;
    });
  }

  // 解析时长字符串为分钟数
  parseDuration(durationStr) {
    if (durationStr === '实时') return 0;
    
    const match = durationStr.match(/(\d+)-(\d+)小时/);
    if (match) {
      const minHours = parseInt(match[1]);
      const maxHours = parseInt(match[2]);
      return ((minHours + maxHours) / 2) * 60; // 平均小时数转为分钟
    }
    
    return 120; // 默认2小时
  }

  // 计算具体路线的详细费用
  calculateRouteDetails(route, amount) {
    const steps = [];
    let totalFees = 0;
    let totalDuration = 0;
    
    for (let i = 0; i < route.length - 1; i++) {
      const fromBank = Object.values(this.banks).find(b => b.id === route[i]);
      const toBank = Object.values(this.banks).find(b => b.id === route[i + 1]);
      
      if (!fromBank || !toBank) continue;
      
      const connection = fromBank.reachableBanks.find(r => r.id === toBank.id);
      if (!connection) continue;
      
      const transferFee = connection.transferFee.fixed + (amount * connection.transferFee.percentage);
      const arrivalFee = connection.arrivalFee.fixed + (amount * connection.arrivalFee.percentage);
      const stepFees = transferFee + arrivalFee;
      const duration = this.parseDuration(connection.expectedDuration);
      
      steps.push({
        fromBank: fromBank.name,
        toBank: toBank.name,
        transferFee: transferFee,
        arrivalFee: arrivalFee,
        totalStepFee: stepFees,
        expectedDuration: connection.expectedDuration,
        durationMinutes: duration
      });
      
      totalFees += stepFees;
      totalDuration += duration;
    }
    
    return {
      steps: steps,
      totalFees: totalFees,
      totalDuration: totalDuration,
      netAmount: amount - totalFees
    };
  }
}

module.exports = RoutePlanner;