---
name: example-iothub
description: cube-webapi-backend 端到端示例 —— IoTHub 设备/协议 API（控制器选型 + 自定义权限位 + 数据范围 + 多租户），把 §三/§六/§十 串成可直接套用的范例。写设备/协议类业务 API 前先读本文件对照。
---

# 端到端示例：IoTHub 设备 / 协议 API（选型 + 自定义权限 + 数据范围 + 多租户）

> 原 SKILL.md §十三（**保真**）。把 §三 公共控制器选型、§六 自定义权限位、§十 数据范围权限串成一个可直接套用的范例。

## 十三、端到端示例：IoTHub 设备 / 协议 API（选型 + 自定义权限 + 数据范围 + 多租户）

把前面三块（公共控制器选型、自定义权限位、数据范围权限）串成一个可直接套用的范例。
场景：IoTHub 物联网平台需暴露 **设备（Device）**、**协议模板（Protocol，TCP/UDP/MQTT/Modbus 等 UI 驱动配置）**、
**协议实例（ProtocolInstance，同一协议可连多个平台实例）** 的标准 API，并给“下发指令 / 远程配置”这类**非 CRUD 业务操作**定义自定义权限位，
同时对设备数据按**多租户 + 部门/本人**施加数据范围隔离。

> 分层落点（与 IoTHub 四层架构对应）：实体（`Device`/`Protocol`…）放 **Core** 层由 Model.xml + Build.tt 生成；
> `XxxController` 放 **WebAPI** 层（本 skill 关注层）；多实例驱动连接管理在 **Server/Protocols** 层，不在 API 控制器里。

### 13.1 选型总览

| 资源 | 基类 | 原因 |
|------|------|------|
| 设备 `Device` | `EntityController<Device, DeviceModel>` | 标准 CRUD + 需自定义权限位（下发/配置 Action） |
| 协议模板 `Protocol` | `EntityController<Protocol, ProtocolModel>` | UI 驱动配置，需新增/修改；仅后台可见 `Admin` |
| 协议实例 `ProtocolInstance` | `EntityController<ProtocolInstance, ProtocolInstanceModel>` | 多实例，标准 CRUD |
| 设备分组 `DeviceGroup` | `EntityTreeApiController<DeviceGroup, DeviceGroupModel>` | 树形，WebApi 必须用 `EntityTreeApiController`（非 `EntityTreeController`） |

### 13.2 实体接入数据范围（多租户 + 部门/本人）

设备数据属敏感业务数据，按“本人/本部门/本部门及下级”隔离，且跨租户隔离。字段名非默认（`CreateUserID`/`DepartmentID`/`TenantID`），必须实现 `IDataScopeFieldProvider`：

```csharp
[Serializable]
public partial class Device : Entity<Device>, IDataScope, IDataScopeFieldProvider
{
    #region 属性（由 Model.xml + Build.tt 生成，此处仅示意）
    [DisplayName("编号")]     public Int32  ID                { get; set; }
    [DisplayName("设备名称")] public String Name              { get; set; }
    [DisplayName("协议实例")] public Int32  ProtocolInstanceID { get; set; }
    [DisplayName("创建人")]   public Int32  CreateUserID       { get; set; }  // 非默认 UserId
    [DisplayName("部门")]     public Int32  DepartmentID       { get; set; }  // 非默认 DepartmentId
    [DisplayName("租户")]     public Int32  TenantID           { get; set; }  // 非默认 TenantId
    #endregion

    // 非默认字段名必须显式映射，否则数据范围过滤字段写错
    public FieldItem GetUserField()       => Meta.Table.FindByName("CreateUserID");
    public FieldItem GetDepartmentField() => Meta.Table.FindByName("DepartmentID");
    public FieldItem GetTenantField()     => Meta.Table.FindByName("TenantID");

    static Device()
    {
        Meta.Interceptors.Add<DataScopeInterceptor>();  // 查询自动 AND 范围/租户条件；增删改自动校验归属
    }
}
```

> 角色管理里给相关角色设 `DataScope`（仅本人/本部门/本部门及下级/自定义/全部）；多角色取最宽。
> `EnableTenant` 开启时 `ApplyScope` 还会追加 `TenantID={#TenantId}` 实现跨租户隔离（见第十节）。

### 13.3 标准 CRUD 控制器

```csharp
[IoTHubArea]                                                   // 区域特性（[Area("IoTHub")]）
[DisplayName("设备")]
[Menu(10, true, Mode = MenuModes.Admin | MenuModes.Tenant, Icon = "fa-microchip")]
public class DeviceController : EntityController<Device, DeviceModel>
{
    static DeviceController()
    {
        // 字段定制只在静态构造器（全局一次性）
        // ⚠️ RemoveField 逐字段多参（本版本不解析逗号串，见上方 StudentController 注释）
        ListFields.RemoveField("CreateUserID", "DepartmentID", "TenantID");   // 由数据范围自动约束，不暴露
        AddFormFields.RemoveField("CreateUserID", "DepartmentID", "TenantID");
        EditFormFields.RemoveField("CreateUserID", "DepartmentID", "TenantID");
    }

    // 开启字段级校验，Insert/Update 失败时返回 FieldErrors
    protected override Boolean EnableFieldValidation => true;
}

[IoTHubArea]
[DisplayName("协议")]
[Menu(5, true, Mode = MenuModes.Admin, Icon = "fa-network-wired")]  // 协议模板仅后台可见，租户不可见
public class ProtocolController : EntityController<Protocol, ProtocolModel> { }

[IoTHubArea]
[DisplayName("协议实例")]
[Menu(6, true, Mode = MenuModes.Admin | MenuModes.Tenant)]
public class ProtocolInstanceController : EntityController<ProtocolInstance, ProtocolInstanceModel> { }
```

### 13.4 自定义权限位：下发指令 / 远程配置

CRUD 之外的业务操作，用更高权限位 `(PermissionFlags)16` / `(PermissionFlags)32` + `[DisplayName]` 命名；
权限项由框架扫描 `[EntityAuthorize]` 自动出现在角色管理（见 6.2/6.4）。同时用 `DataScopeHelper.CanAccess` 做数据范围归属校验：

```csharp
[IoTHubArea]
[DisplayName("设备指令")]
[Menu(20, true, Mode = MenuModes.Admin | MenuModes.Tenant)]
public class DeviceCommandController : ControllerBaseX   // 非实体 CRUD，用根基类亦可；此处展示自定义 Action
{
    // 自定义权限位 16 = 下发指令
    [EntityAuthorize((PermissionFlags)16)]
    [DisplayName("下发指令")]
    [HttpPost]                                                     // 路由：POST /api/IoTHub/DeviceCommand/SendCommand
    public ApiResponse<String> SendCommand(Int32 deviceId, String payload)
    {
        var dev = Device.FindByID(deviceId);
        if (dev == null) return "设备不存在".ToFailApiResponse<String>();
        if (!DataScopeHelper.CanAccess(dev))                       // 越权（非本人/非本部门/非同租户）拦截
            return "无权操作该设备".ToFailApiResponse<String>();

        // 经 ProtocolInstance 找到对应平台连接，下发到 Server/Protocols 层
        var inst = ProtocolInstance.FindByID(dev.ProtocolInstanceID);
        // Server.Publish(inst, payload);
        return "指令已下发".ToOkApiResponse();
    }

    // 自定义权限位 32 = 远程配置
    [EntityAuthorize((PermissionFlags)32)]
    [DisplayName("远程配置")]
    [HttpPost]
    public ApiResponse<String> RemoteConfig(Int32 deviceId, String config)
    {
        var dev = Device.FindByID(deviceId);
        if (dev == null) return "设备不存在".ToFailApiResponse<String>();
        if (!DataScopeHelper.CanAccess(dev))
            return "无权操作该设备".ToFailApiResponse<String>();
        // ... 下发配置
        return "配置已下发".ToOkApiResponse();
    }
}
```

> 角色管理里 `设备指令` 菜单下会自动出现「下发指令 / 远程配置」两项自定义权限，按需分配给运维角色；
> 未授权用户调用 → **403**（见 6.5）。若把这两个 Action 直接放在 `DeviceController` 上，权限项会挂在 `设备` 菜单下，按需选择即可。

### 13.5 多租户与菜单可见性

- `[Menu(..., Mode = MenuModes.Admin | MenuModes.Tenant)]`：设备/协议实例对后台与租户**都可见**；协议模板用纯 `Admin`，**租户不可见**（避免租户自造协议）。
- `CubeSetting.Current.EnableTenant = true` 开启租户模式后，`ControllerBaseX` 的 `OnActionExecuting` 会对无有效租户上下文的请求 **fail-closed**（403），`Device` 的 `ApplyScope` 追加 `TenantID` 过滤。

### 13.6 端到端鉴权与数据范围流（一次下发指令请求）

1. 前端 `POST /api/IoTHub/DeviceCommand/SendCommand`，Header 带 `Authorization: Bearer <token>`；
2. `ControllerBaseX.LoadToken()` 解析令牌拿到当前用户；`ValidateTenant` 校验租户上下文；
3. `EntityAuthorize` 定位菜单 `设备指令`，`SetMenu(menu)` 写入 `DataScopeContext`（供数据范围解析）；
4. `user.Has(menu, (PermissionFlags)16)` 判定是否有“下发指令”权限 → 无则 **403**；
5. `Device.FindByID` 走 `DataScopeInterceptor`，查询已自动 AND 上「本人/本部门 + 当前租户」范围；
6. `DataScopeHelper.CanAccess(dev)` 二次校验单行归属 → 越权返回失败；
7. 通过后下发到 Server 层，返回 `{ code:0, data:"指令已下发" }`（CamelCase、Int64 字符串化）。

> 前端界面：用 `GET /api/IoTHub/Device/GetPage` 拿字段元数据驱动动态表格/表单（见第五节）；
> 权限控制按钮显隐：前端可据 `GET /Auth/Info` 返回的用户权限，或在有 `GetFields` 的界面结合菜单权限隐藏“下发/配置”按钮。

### 13.7 本示例要点回顾

- 选型：标准主数据 → `EntityController`；树形 → `EntityTreeApiController`；仅后台模板 → `Admin` 可见的 `EntityController`；
- 自定义权限：用 `(PermissionFlags)16/32` + `[DisplayName]`，靠扫描自动注册权限项；
- 数据范围：实体接 `IDataScope` + `IDataScopeFieldProvider`（非默认字段名）+ 注册 `DataScopeInterceptor`；
- 多租户：`EnableTenant` + `TenantID` 字段 + 菜单 `Admin|Tenant` 可见性；
- 校验：需 `FieldErrors` 时子类 `override EnableFieldValidation => true`。
