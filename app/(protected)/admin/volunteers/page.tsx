import { DataTable } from "@/components/forms/data-table";
import { VolunteerTable } from "@/components/volunteers/volunteer-table";
import { CreateVolunteerForm } from "@/features/volunteers/create-volunteer-form";
import { getVolunteers } from "@/services/volunteer.service";

export default async function AdminVolunteersPage() {
  const volunteers = await getVolunteers();

  return (
    <DataTable
      title="Voluntarios"
      description="Gestiona voluntarios activos, monitorea la confiabilidad y revisa el historial del perfil."
      actions={<CreateVolunteerForm />}
    >
      <VolunteerTable volunteers={volunteers} />
    </DataTable>
  );
}
