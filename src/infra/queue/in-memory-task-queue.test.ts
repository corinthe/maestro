import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryTaskQueue } from "./in-memory-task-queue.js";
import { createTask } from "../../domain/task/index.js";

describe("InMemoryTaskQueue", () => {
  let queue: InMemoryTaskQueue;

  beforeEach(() => {
    queue = new InMemoryTaskQueue();
  });

  describe("push / pop", () => {
    it("doit ajouter une tache dans la queue et la retirer en FIFO", () => {
      const task1 = createTask("Tache 1", "Description 1");
      const task2 = createTask("Tache 2", "Description 2");

      queue.push(task1);
      queue.push(task2);

      const popped = queue.pop();
      expect(popped).toBeDefined();
      expect(popped!.id).toBe(task1.id);

      const popped2 = queue.pop();
      expect(popped2).toBeDefined();
      expect(popped2!.id).toBe(task2.id);
    });

    it("doit retourner undefined quand on pop une queue vide", () => {
      const result = queue.pop();
      expect(result).toBeUndefined();
    });
  });

  describe("peek", () => {
    it("doit retourner la premiere tache sans la retirer", () => {
      const task = createTask("Tache peek", "Description");
      queue.push(task);

      const peeked = queue.peek();
      expect(peeked).toBeDefined();
      expect(peeked!.id).toBe(task.id);
      expect(queue.length).toBe(1);
    });

    it("doit retourner undefined quand on peek une queue vide", () => {
      const result = queue.peek();
      expect(result).toBeUndefined();
    });
  });

  describe("length", () => {
    it("doit retourner 0 pour une queue vide", () => {
      expect(queue.length).toBe(0);
    });

    it("doit refleter le nombre de taches dans la queue", () => {
      queue.push(createTask("Tache 1", "Desc"));
      queue.push(createTask("Tache 2", "Desc"));
      queue.push(createTask("Tache 3", "Desc"));

      expect(queue.length).toBe(3);
    });

    it("doit se mettre a jour apres push et pop", () => {
      queue.push(createTask("Tache 1", "Desc"));
      queue.push(createTask("Tache 2", "Desc"));
      expect(queue.length).toBe(2);

      queue.pop();
      expect(queue.length).toBe(1);

      queue.pop();
      expect(queue.length).toBe(0);
    });
  });

  describe("operations multiples", () => {
    it("doit maintenir l'ordre FIFO avec plusieurs push et pop successifs", () => {
      const task1 = createTask("Tache A", "Desc");
      const task2 = createTask("Tache B", "Desc");
      const task3 = createTask("Tache C", "Desc");

      queue.push(task1);
      queue.push(task2);

      const first = queue.pop();
      expect(first!.id).toBe(task1.id);

      queue.push(task3);

      const second = queue.pop();
      expect(second!.id).toBe(task2.id);

      const third = queue.pop();
      expect(third!.id).toBe(task3.id);

      expect(queue.pop()).toBeUndefined();
      expect(queue.length).toBe(0);
    });
  });
});
