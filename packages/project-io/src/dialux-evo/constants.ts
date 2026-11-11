/** DIALux evo 12.1 archive member paths (from reference AED-180297 L9M). */
export const EVO_ARCHIVE_MEMBERS = [
  "ArchiveInfo/ArchiveInfo.xml",
  "ArchiveInfo/Thumbnail.png",
  "Project/ScenegraphScene",
  "Project/InteractionManager/ChartingManager.V1.json",
  "Project/InteractionManager/StfManager.dat",
  "Project/InteractionManager/StfManager.xml",
  "Project/InteractionManager/ToolManager.dat",
  "Project/InteractionManager/ToolManager.xml",
  "Project/Output/OutputSettings.xml",
  "Project/ProjectData/ProjectData.dat",
  "Project/ProjectData/ProjectData.xml",
  "Project/Results/ProjectToc.rsl",
  "Project/STF/fu1tpabp.tmp",
  "Project/ViewThumbnails/2nzvjtqm.tmp",
  "Project/ViewThumbnails/3bthid1u.tmp",
  "Project/Textures/",
] as const;

/** Native DIALux evo 12.1 archives include this empty folder entry. */
export const EVO_REQUIRED_DIRECTORY_ENTRIES = ["Project/Textures/"] as const;

export const DIALUX_EVO_VERSION = "5.12.1.7275";
export const DIALUX_EVO_MIN_VERSION = "5.12.1.0";
export const DIALUX_EVO_SCHEMA = "DIALux {5%2E12%2E1%2E7275}";

/** STEP entity ids for Building→CoordSys3D world placement (9 room zones). */
export const TEMPLATE_BUILDING_COORD_IDS = [
  629, 668, 707, 746, 785, 824, 863, 902, 941,
] as const;

/** STEP entity ids for Room→CoordSys3D (local room origin within building). */
export const TEMPLATE_ROOM_ORIGIN_COORD_IDS = [
  656, 695, 734, 773, 812, 851, 890, 929, 968,
] as const;

export const MAX_TEMPLATE_ROOMS = TEMPLATE_BUILDING_COORD_IDS.length;

/** Inner / outer contour vertex counts per template room slot (AED-180297 L9M reference). */
export const TEMPLATE_SLOT_INNER_VERTICES = [9, 4, 25, 8, 6, 4, 4, 4, 44] as const;
export const TEMPLATE_SLOT_OUTER_VERTICES = [8, 4, 25, 8, 6, 4, 4, 4, 43] as const;
