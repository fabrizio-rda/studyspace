import { beforeEach, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ getSession: vi.fn(), rpc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({auth:{getSession:sdk.getSession, stopAutoRefresh(){}},rpc:sdk.rpc}) }));
import { bindCloudIdentity, readCloud } from "./cloud";
beforeEach(()=>{
  localStorage.setItem("studyspace:public-config:v1",JSON.stringify({supabaseUrl:"https://audit.supabase.co",supabaseKey:"sb_publishable_audit"}));
  sdk.rpc.mockReset();sdk.getSession.mockReset();bindCloudIdentity("a");
});
it("no envía un RPC si la identidad cambia mientras se resuelve la sesión",async()=>{
  let resolve!: (v: unknown)=>void;
  sdk.getSession.mockReturnValue(new Promise(r=>{resolve=r}));
  const pending=readCloud("a");
  const rejected=expect(pending).rejects.toThrow("La sesión cambió");
  bindCloudIdentity("b");
  resolve({data:{session:{user:{id:"a"},access_token:"test-a"}},error:null});
  await rejected;expect(sdk.rpc).not.toHaveBeenCalled();
});
it("fija la credencial de la identidad comprobada y aborta al cambiar de cuenta",async()=>{
  const setHeader=vi.fn(); let signal: AbortSignal | undefined;
  const builder={setHeader:(...args: unknown[])=>{setHeader(...args);return builder;},abortSignal:(s:AbortSignal)=>{signal=s;return Promise.resolve({data:{revision:0,state:null,mutation_id:null},error:null});}};
  sdk.rpc.mockReturnValue(builder);
  sdk.getSession.mockResolvedValue({data:{session:{user:{id:"a"},access_token:"test-a"}},error:null});
  await readCloud("a");
  expect(setHeader).toHaveBeenCalledWith("Authorization","Bearer test-a");
  bindCloudIdentity("b");expect(signal?.aborted).toBe(true);
});
