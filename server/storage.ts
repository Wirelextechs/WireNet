// In-memory storage for development
// In production, use a proper database

interface Settings {
  id: string;
  whatsappLink?: string;
  datagodEnabled: boolean;
  fastnetEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AdminUser {
  id: string;
  username: string;
  password: string;
  createdAt: Date;
}

class Storage {
  private settings: Settings | null = null;
  private adminUsers: Map<string, AdminUser> = new Map();

  constructor() {
    // Initialize with default settings
    this.settings = {
      id: "default",
      whatsappLink: "",
      datagodEnabled: true,
      fastnetEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Initialize with default admin user (username: admin, password: admin)
    this.adminUsers.set("admin", {
      id: "1",
      username: "admin",
      password: "admin", // In production, use bcrypt
      createdAt: new Date(),
    });
  }

  async getSettings(): Promise<Settings | null> {
    return this.settings;
  }

  async updateSettings(data: Partial<Settings>): Promise<Settings> {
    if (!this.settings) {
      this.settings = {
        id: "default",
        whatsappLink: "",
        datagodEnabled: true,
        fastnetEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    this.settings = {
      ...this.settings,
      ...data,
      updatedAt: new Date(),
    };

    return this.settings;
  }

  async getAdminUser(username: string): Promise<AdminUser | null> {
    return this.adminUsers.get(username) || null;
  }

  async createAdminUser(username: string, password: string): Promise<AdminUser> {
    const user: AdminUser = {
      id: Math.random().toString(36).substr(2, 9),
      username,
      password, // In production, hash this
      createdAt: new Date(),
    };

    this.adminUsers.set(username, user);
    return user;
  }
}

export const storage = new Storage();
