import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../common/enums/role.enum';
import { AuthService } from './auth.service';

const mockUser = {
  id: 'uuid-1',
  username: 'john',
  email: 'john@example.com',
  password: 'hashed',
  department: 'EFM',
  role: Role.User,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
} as User;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findByEmail: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('test-token') },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
  });

  describe('register', () => {
    it('hashes password and returns user without password', async () => {
      usersService.create.mockResolvedValue(mockUser);
      const result = await service.register({
        username: 'john',
        email: 'john@example.com',
        password: 'secret123',
        department: 'EFM',
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          password: expect.not.stringContaining('secret123'),
        }),
      );
      expect(result).not.toHaveProperty('password');
    });

    it('propagates ConflictException from UsersService', async () => {
      usersService.create.mockRejectedValue(
        new ConflictException('Username already taken'),
      );
      await expect(
        service.register({
          username: 'john',
          email: 'john@example.com',
          password: 'secret123',
          department: 'EFM',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns access_token on valid credentials', async () => {
      const hashed = await bcrypt.hash('secret123', 10);
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        password: hashed,
      });
      const result = await service.login({
        email: 'john@example.com',
        password: 'secret123',
      });
      expect(result.access_token).toBe('test-token');
      expect(result.user.email).toBe('john@example.com');
    });

    it('throws UnauthorizedException when user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: 'x@x.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on wrong password', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        password: hashed,
      });
      await expect(
        service.login({ email: 'john@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
