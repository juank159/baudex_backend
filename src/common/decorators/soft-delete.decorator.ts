import { Repository } from 'typeorm';

export function WithSoftDelete<T extends Repository<any>>(repository: T) {
  return class extends (repository as any) {
    async findAllWithDeleted() {
      return this.find({ withDeleted: true });
    }

    async findOnlyDeleted() {
      return this.find({
        where: { deletedAt: true } as any,
        withDeleted: true,
      });
    }

    async softDelete(id: string) {
      return this.softDelete(id);
    }

    async restore(id: string) {
      return this.restore(id);
    }
  };
}
