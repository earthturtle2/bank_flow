const fs = require('fs').promises;
const path = require('path');

class FileSystemPersistence {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.tasksFile = path.join(dataDir, 'tasks.json');
    this.init();
  }

  async init() {
    try {
      await fs.access(this.dataDir);
    } catch (error) {
      await fs.mkdir(this.dataDir, { recursive: true });
    }
    
    try {
      await fs.access(this.tasksFile);
    } catch (error) {
      await fs.writeFile(this.tasksFile, JSON.stringify([], null, 2));
    }
  }

  // 保存任务
  async saveTask(task) {
    const tasks = await this.getAllTasks();
    const existingIndex = tasks.findIndex(t => t.id === task.id);
    
    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
    } else {
      tasks.push(task);
    }
    
    await fs.writeFile(this.tasksFile, JSON.stringify(tasks, null, 2));
    return task;
  }

  // 获取所有任务
  async getAllTasks() {
    try {
      const data = await fs.readFile(this.tasksFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  // 根据ID获取任务
  async getTaskById(id) {
    const tasks = await this.getAllTasks();
    return tasks.find(task => task.id === id);
  }

  // 删除任务
  async deleteTask(id) {
    const tasks = await this.getAllTasks();
    const filteredTasks = tasks.filter(task => task.id !== id);
    await fs.writeFile(this.tasksFile, JSON.stringify(filteredTasks, null, 2));
    return true;
  }

  // 获取待处理的任务
  async getPendingTasks() {
    const tasks = await this.getAllTasks();
    return tasks.filter(task => task.status === 'pending' || task.status === 'processing');
  }

  // 获取已完成的任务
  async getCompletedTasks() {
    const tasks = await this.getAllTasks();
    return tasks.filter(task => task.status === 'completed');
  }

  // 获取已取消的任务
  async getCancelledTasks() {
    const tasks = await this.getAllTasks();
    return tasks.filter(task => task.status === 'cancelled');
  }
}

module.exports = FileSystemPersistence;