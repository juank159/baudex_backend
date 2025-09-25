export interface ISoftDelete {
  softRemove(): Promise<this>;
  recover(): Promise<this>;
}
