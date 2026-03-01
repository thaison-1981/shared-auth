import * as drizzle_orm_pg_core from 'drizzle-orm/pg-core';

/** Shared sessions table for connect-pg-simple. Identical across all apps. */
declare const sessions: drizzle_orm_pg_core.PgTableWithColumns<{
    name: "sessions";
    schema: undefined;
    columns: {
        sid: drizzle_orm_pg_core.PgColumn<{
            name: "sid";
            tableName: "sessions";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        sess: drizzle_orm_pg_core.PgColumn<{
            name: "sess";
            tableName: "sessions";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        expire: drizzle_orm_pg_core.PgColumn<{
            name: "expire";
            tableName: "sessions";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;

export { sessions };
