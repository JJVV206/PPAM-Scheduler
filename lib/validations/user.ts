import { z } from "zod";

import { USER_ROLES } from "@/lib/constants/domain";

export const updateUserRoleSchema = z.object({
  role: z.enum(USER_ROLES)
});
