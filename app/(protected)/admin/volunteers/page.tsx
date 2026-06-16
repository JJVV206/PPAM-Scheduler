import { DataTable } from "@/components/forms/data-table";
import { VolunteerTable } from "@/components/volunteers/volunteer-table";
import { UserRoleManagement } from "@/features/admin/user-role-management";
import { CreateVolunteerForm } from "@/features/volunteers/create-volunteer-form";
import { getUserAccounts } from "@/services/user.service";
import { getVolunteers } from "@/services/volunteer.service";

export default async function AdminVolunteersPage() {
  const [volunteers, accounts] = await Promise.all([
    getVolunteers(),
    getUserAccounts()
  ]);

  return (
    <div className="space-y-6">
      <DataTable
        title="Voluntarios"
        description="Gestiona voluntarios activos, consulta su contacto y revisa el historial del perfil."
        actions={<CreateVolunteerForm />}
      >
        <VolunteerTable volunteers={volunteers} />
      </DataTable>
      <DataTable
        title="Cuentas y roles"
        description="Delega acceso de administrador o voluntario a las cuentas registradas."
      >
        <UserRoleManagement accounts={accounts} />
      </DataTable>
    </div>
  );
}
