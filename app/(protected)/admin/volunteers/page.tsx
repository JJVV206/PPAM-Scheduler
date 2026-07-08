import { DataTable } from "@/components/forms/data-table";
import { UserAdmissionManagement } from "@/features/admin/user-admission-management";
import { UserDirectoryManagement } from "@/features/admin/user-directory-management";
import { CreateVolunteerForm } from "@/features/volunteers/create-volunteer-form";
import { getUserAccounts } from "@/services/user.service";
import { getVolunteers } from "@/services/volunteer.service";

export default async function AdminVolunteersPage() {
  const [volunteers, accounts] = await Promise.all([
    getVolunteers({ activeOnly: true }),
    getUserAccounts()
  ]);

  return (
    <div className="space-y-6">
      <DataTable
        title="Solicitudes de admisión"
        description="Aprueba o rechaza cuentas de voluntario creadas desde el registro público."
      >
        <UserAdmissionManagement accounts={accounts} />
      </DataTable>
      <DataTable
        title="Usuarios"
        description="Consulta cuentas aprobadas y suspendidas, filtra por rol y gestiona acceso desde cada perfil."
        actions={<CreateVolunteerForm />}
      >
        <UserDirectoryManagement accounts={accounts} volunteers={volunteers} />
      </DataTable>
    </div>
  );
}
