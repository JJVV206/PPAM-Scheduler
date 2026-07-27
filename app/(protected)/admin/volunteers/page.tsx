import { DataTable } from "@/components/forms/data-table";
import { UserAdmissionManagement } from "@/features/admin/user-admission-management";
import { UserDirectoryManagement } from "@/features/admin/user-directory-management";
import { CreateVolunteerForm } from "@/features/volunteers/create-volunteer-form";
import { getUserAccounts } from "@/services/user.service";
import { getVolunteers } from "@/services/volunteer.service";

export default async function AdminVolunteersPage() {
  const [volunteers, pendingAccounts, directoryAccounts] = await Promise.all([
    getVolunteers({ activeOnly: true }),
    getUserAccounts({ accessStatuses: ["PENDING_APPROVAL"] }),
    getUserAccounts({
      accessStatuses: ["APPROVED", "SUSPENDED", "REJECTED"]
    })
  ]);

  return (
    <div className="space-y-6">
      <DataTable
        title="Solicitudes pendientes de admisión"
        description="Aprueba o rechaza cuentas de voluntario creadas desde el registro público."
      >
        <UserAdmissionManagement accounts={pendingAccounts} />
      </DataTable>
      <DataTable
        title="Usuarios"
        description="Consulta cuentas aprobadas, suspendidas y rechazadas, filtra por rol y gestiona acceso desde cada perfil."
        actions={<CreateVolunteerForm />}
      >
        <UserDirectoryManagement
          accounts={directoryAccounts}
          volunteers={volunteers}
        />
      </DataTable>
    </div>
  );
}
