"use client";

import { Button } from "@/components/ui/button";
import { PointFormDialog } from "@/features/points/point-form-dialog";

export function CreatePointForm() {
  return <PointFormDialog trigger={<Button>Agregar punto</Button>} />;
}
