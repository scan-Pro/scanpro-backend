import { prisma } from '../../../config/database.js';
export class UsersRepository {
    async findById(id) {
        return prisma.user.findUnique({
            where: { id },
        });
    }
    async updateProfile(id, data) {
        return prisma.user.update({
            where: { id },
            data,
        });
    }
    async deleteUser(id) {
        await prisma.user.delete({
            where: { id },
        });
    }
}
//# sourceMappingURL=users.repository.js.map