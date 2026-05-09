/**
 * 用户 / 角色 / 部门「id ↔ 显示名」缓存与远程加载。
 *
 * 设计动机：
 *   设计器里好几处地方需要把 [1, 2, 5] 这样的 id 数组渲染成「张三、李四、王五」
 *   这样的人名 tag —— 比如审批人配置面板的多选回显、模拟运行对话框的策略
 *   描述、属性面板的 hover tooltip。如果每个组件都自己 axios.get 一次，会
 *   出现「同一个用户列表被请求 5 次」的浪费，且没法做缓存失效。
 *
 *   这里把它们集中成一个 module-level 单例 store —— **不是** Pinia store，
 *   因为这层数据本质是「读多写极少 + 进程内可丢弃」，引入 Pinia 反而增加
 *   样板代码。直接用顶层 ref + Promise 缓存即可。
 *
 * 失效策略：
 *   首次加载后**不**自动失效。流程设计器是个「打开 → 编辑 → 关掉」的短
 *   生命周期场景，没必要在内部维护过期时间。如果将来有「设计器开着的
 *   时候组织架构变了」的诉求，加一个 invalidate() 方法即可，调用方在
 *   websocket 推送时主动调。
 */
import { ref, type Ref } from 'vue';
import { getUserPage, getRolePage, getDeptTree } from '@/api/admin';
import type { SysUser, SysRole, SysDept, PageResult, R } from '@/types/api';

interface OrgOption {
  id: number;
  label: string;
}

const usersRef = ref<OrgOption[]>([]);
const rolesRef = ref<OrgOption[]>([]);
const deptsRef = ref<OrgOption[]>([]);

// Promise 缓存，避免并发场景下重复发请求（典型情况：设计器一打开
// 就有 3 个组件同时调 ensureUsers()）。
let usersPromise: Promise<OrgOption[]> | null = null;
let rolesPromise: Promise<OrgOption[]> | null = null;
let deptsPromise: Promise<OrgOption[]> | null = null;

/**
 * 拉取一次「全部用户」。注意 admin 后端的 user/page 默认带分页，
 * 这里给一个足够大的 size = 9999 拿到全量 —— 流程设计器场景下
 * 真实公司用户数通常 < 几千，一次拉够。
 *
 * 如果将来公司规模超过这个量级，需要切换成「输入搜索词后远程过滤」
 * 的模式，那时把本函数改成 searchUsers(keyword) 即可，外部 API
 * 几乎不用改。
 */
async function ensureUsers(): Promise<OrgOption[]> {
  if (!usersPromise) {
    usersPromise = (async () => {
      // axios 响应拦截器返回完整 response，需要先取 response.data 得到 R<T>
      const axiosRes = await getUserPage({ pageNum: 1, pageSize: 9999 });
      const body = (axiosRes as any).data as R<PageResult<SysUser>>;
      const list = body?.data?.records ?? [];
      const opts = list.map<OrgOption>((u) => ({
        id: u.userId,
        label: u.realName ? `${u.realName} (${u.username})` : u.username,
      }));
      usersRef.value = opts;
      return opts;
    })().catch((err) => {
      // 失败时清掉 promise，下次调用还能重试
      usersPromise = null;
      throw err;
    });
  }
  return usersPromise;
}

async function ensureRoles(): Promise<OrgOption[]> {
  if (!rolesPromise) {
    rolesPromise = (async () => {
      const axiosRes = await getRolePage({ pageNum: 1, pageSize: 9999 });
      const body = (axiosRes as any).data as R<PageResult<SysRole>>;
      const list = body?.data?.records ?? [];
      const opts = list.map<OrgOption>((r) => ({
        id: r.roleId,
        label: `${r.roleName} (${r.roleCode})`,
      }));
      rolesRef.value = opts;
      return opts;
    })().catch((err) => {
      rolesPromise = null;
      throw err;
    });
  }
  return rolesPromise;
}

async function ensureDepts(): Promise<OrgOption[]> {
  if (!deptsPromise) {
    deptsPromise = (async () => {
      const axiosRes = await getDeptTree();
      const body = (axiosRes as any).data as R<SysDept[]>;
      const tree = body?.data ?? [];
      // 部门返回的是树形结构，扁平化后回填带缩进的 label，让选择器
      // 即使没有 tree 控件也能看出层级。
      const opts: OrgOption[] = [];
      const walk = (nodes: SysDept[], depth: number) => {
        for (const n of nodes) {
          opts.push({ id: n.deptId, label: `${'　'.repeat(depth)}${n.deptName}` });
          if (n.children?.length) walk(n.children, depth + 1);
        }
      };
      walk(tree, 0);
      deptsRef.value = opts;
      return opts;
    })().catch((err) => {
      deptsPromise = null;
      throw err;
    });
  }
  return deptsPromise;
}

export function useOrgResolvers() {
  return {
    users: usersRef as Readonly<Ref<OrgOption[]>>,
    roles: rolesRef as Readonly<Ref<OrgOption[]>>,
    depts: deptsRef as Readonly<Ref<OrgOption[]>>,
    ensureUsers,
    ensureRoles,
    ensureDepts,
  };
}

export type { OrgOption };
