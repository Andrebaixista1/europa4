#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
API-NewCorban-RT

Pipeline em 2 fases (quase real-time):
- Fase quente (curto intervalo): processa janelas de hoje e ontem, em loop, a cada 60â€“120s.
  1) MERGE direto na dbo.cadastrados_test pelas chaves: data_formalizacao, data_cadastro, cadastro, data_pagamento, pagamento, proposta_id

- Fase profunda (opcional): varredura de 90 dias, quinzena a quinzena. Habilite via env RUN_DEEP_SCAN=1

Requisitos no servidor: requests, pyodbc, python-dateutil; ODBC Driver 17 for SQL Server
"""

import os
import time
import json
import types
from datetime import datetime, timedelta
import time
from dateutil import parser as dateparser
import unicodedata

# Evita dependÃªncia de OpenSSL do urllib3/requests no host (stub simples)
import sys
if "urllib3.contrib.pyopenssl" not in sys.modules:
    pyopenssl_stub = types.ModuleType("urllib3.contrib.pyopenssl")
    pyopenssl_stub.inject_into_urllib3 = lambda *args, **kwargs: None
    pyopenssl_stub.extract_from_urllib3 = lambda *args, **kwargs: None
    sys.modules["urllib3.contrib.pyopenssl"] = pyopenssl_stub

import requests
import pyodbc


# ===== CONFIG =====
SQL = {
    "server": os.getenv("SQL_SERVER", "10.144.239.117"),
    "port": int(os.getenv("SQL_PORT", "1433")),
    "database": os.getenv("SQL_DB", "vieira_online"),
    "user": os.getenv("SQL_USER", "andrefelipe"),
    "password": os.getenv("SQL_PASS", "899605aA@"),
    "driver": os.getenv("SQL_DRIVER", "ODBC Driver 17 for SQL Server"),
    "timeout": int(os.getenv("SQL_TIMEOUT", "600")),
}

EMPRESAS = [
    {"empresa": "vieira",           "url": "https://api.newcorban.com.br/api/propostas/", "username": "robo.planejamento",   "password": "O{h4Fj7A>1I3"},
    {"empresa": "abbcred",          "url": "https://api.newcorban.com.br/api/propostas/", "username": "robo.planejamento",   "password": "Vieira@2024!"},
    {"empresa": "impacto",          "url": "https://api.newcorban.com.br/api/propostas/", "username": "robo.planejamento",   "password": "Vieira@12345"},
    {"empresa": "diascredsolucoes", "url": "https://api.newcorban.com.br/api/propostas/", "username": "planejamento.robo",   "password": "bML2Jd^d"},
    {"empresa": "gmpromotora",      "url": "https://api.newcorban.com.br/api/propostas/", "username": "GMPro995.master",     "password": "Vieira@165"},
]

LOOP_SLEEP_SECONDS = 300
RUN_DEEP_SCAN = os.getenv("RUN_DEEP_SCAN", "0") == "1"
BATCH_WINDOWS = int(os.getenv("BATCH_WINDOWS", "2"))  # quantas janelas por ciclo
STATE_FILE = os.getenv("RT_STATE_FILE", "/root/.newcorban_rt_state.json")

RT_WEEKDAYS_ONLY = os.getenv('RT_WEEKDAYS_ONLY','1') == '1'
RT_WINDOW_START = os.getenv('RT_WINDOW_START','07:50')
RT_WINDOW_END   = os.getenv('RT_WINDOW_END','20:50')
RT_TZ           = os.getenv('RT_TZ','America/Sao_Paulo')

DEFAULT_MISSING = None  # grava NULL ao invÃ©s de "NÃ£o Informado"

columns = [
  'empresa','data_formalizacao','data_cadastro','cadastro','data_pagamento','pagamento','data_status_api','data_atualizacao_api','dt_ultima_tentativa_api','status_api','status_api_descricao','banco_averbacao','agencia','agencia_digito','conta','conta_digito','pix','tipo_liberacao','inclusao','cancelado','concluido','averbacao','retorno_saldo','banco_id','banco_nome','convenio_id','convenio_nome','link_formalizacao','orgao','prazo','promotora_id','promotora_nome','produto_id','produto_nome','proposta_id','proposta_id_banco','proposta_reference_api','valor_financiado','valor_liberado','valor_parcela','valor_referencia','valor_meta','valor_total_comissionado','valor_total_repassado_vendedor','valor_total_estornado','valor_total_comissao_liq','valor_total_comissao_franquia','valor_total_repasse_franquia','tabela_id','tabela_nome','flag_aumento','srcc','seguro','proposta_duplicada','taxa','usuariobanco','franquia_id','indicacao_id','enviado_quali','equipe_id','equipe_nome','franquia_nome','origem','origem_id','status_id','substatus','status_nome','tipo_cadastro','usuario_id','vendedor_nome','vendedor_id','digitador_id','digitador_nome','vendedor_cargo_id','vendedor_participante','vendedor_participante_nome','formalizador','formalizador_nome','cliente_id','cliente_cpf','cliente_sexo','nascimento','analfabeto','nao_perturbe','cliente_nome','cep','cidade','estado','telefone_id','documento_id','beneficio_id','endereco_id','matricula','nome_mae','renda','especie','ddb','possui_representante','logradouro','endereco_numero','bairro','telefone_ddd','telefone_numero','banco_refinanciador','beneficio','id_proposta_banco'
]

MERGE_KEYS = [
  'data_formalizacao','data_cadastro','cadastro','data_pagamento','pagamento','proposta_id'
]

dateCols = set([
  'data_formalizacao','data_cadastro','cadastro','data_pagamento','pagamento',
  'data_status_api','data_atualizacao_api','dt_ultima_tentativa_api',
  'inclusao','cancelado','concluido','averbacao','retorno_saldo','nascimento'
])

bitCols = set([
  'flag_aumento','srcc','seguro','proposta_duplicada','enviado_quali',
  'analfabeto','nao_perturbe','possui_representante','vendedor_participante','pix'
])

LENGTH_LIMITS = {
  'estado': 2,
  'cep': 8,
  'cliente_sexo': 1,
  'telefone_ddd': 4,
  'telefone_numero': 20,
  'agencia': 20,
  'agencia_digito': 5,
  'conta': 30,
  'conta_digito': 5,
}


# ===== Helpers =====
def columns_definition_sql():
    cols = ',\n    '.join(f'[{c}] NVARCHAR(4000) NULL' for c in columns)
    return cols.replace("[proposta_id] NVARCHAR(4000) NULL", "[proposta_id] NVARCHAR(450) NULL")

def log_info(m):
    if not (m.startswith("STATUS ") or m.startswith("PROGRESS ")):
        return
    print(f"INFO: {m}", flush=True)

def log_error(m):
    print(f"ERROR: {m}", flush=True)

def parse_date_or_none(v, only_date=False):
    if v is None:
        return None
    s = str(v).strip()
    if s == '':
        return None
    try:
        d = dateparser.parse(s)
        if not d:
            return None
        if only_date:
            return d.strftime('%Y-%m-%d')
        return d.strftime('%Y-%m-%d %H:%M:%S')
    except Exception:
        return None

def normalize_value_text(val):
    if val is None:
        return DEFAULT_MISSING
    if isinstance(val, bool):
        return '1' if val else '0'
    if isinstance(val, (int, float)):
        return str(val)
    s = str(val).strip()
    return s if s != '' else DEFAULT_MISSING

def normalize_4000(val):
    if val is None:
        return None
    v = normalize_value_text(val)
    if v is None:
        return None
    return v if len(v) <= 4000 else v[:4000]

def remove_accents(s: str) -> str:
    try:
        return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    except Exception:
        return s

def normalize_uf(val):
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    s2 = remove_accents(s).upper()
    UF_BY_NAME = {
      'ACRE':'AC','ALAGOAS':'AL','AMAPA':'AP','AMAZONAS':'AM','BAHIA':'BA','CEARA':'CE','DISTRITO FEDERAL':'DF','ESPIRITO SANTO':'ES',
      'GOIAS':'GO','MARANHAO':'MA','MATO GROSSO':'MT','MATO GROSSO DO SUL':'MS','MINAS GERAIS':'MG','PARA':'PA','PARAIBA':'PB','PARANA':'PR',
      'PERNAMBUCO':'PE','PIAUI':'PI','RIO DE JANEIRO':'RJ','RIO GRANDE DO NORTE':'RN','RONDONIA':'RO','RIO GRANDE DO SUL':'RS',
      'RORAIMA':'RR','SANTA CATARINA':'SC','SERGIPE':'SE','SAO PAULO':'SP','TOCANTINS':'TO'
    }
    if len(s2) == 2 and s2 in UF_BY_NAME.values():
        return s2
    cleaned = ''.join(ch if ch.isalpha() or ch.isspace() else ' ' for ch in s2).strip()
    cleaned = ' '.join(cleaned.split())
    return UF_BY_NAME.get(cleaned, None)

def digits_only(val):
    if val is None:
        return ''
    import re
    return re.sub(r'\D+', '', str(val))

def normalize_digits(val, max_len=None):
    d = digits_only(val)
    if not d:
        return None
    return d if not max_len or len(d) <= max_len else d[:max_len]

def format_progress(current, total, width=30):
    if total <= 0:
        bar = '-' * width
        return f"[{bar}] 0/0 (0%)"
    cur = max(0, min(current, total))
    filled = int(width * cur / total)
    if cur == total:
        filled = width
    bar = '#' * filled + '-' * (width - filled)
    pct = int(100 * cur / total)
    return f"[{bar}] {cur}/{total} ({pct}%)"

def format_eta(seconds):
    try:
        total = int(max(0, seconds))
        h = total // 3600
        m = (total % 3600) // 60
        s = total % 60
        return f"{h:02d}:{m:02d}:{s:02d}"
    except Exception:
        return "??:??:??"

# Alinhamento 20/50: calcula segundos até o próximo minuto 20 ou 50
def seconds_until_next_half_hour(now=None, tz=None):
    try:
        if now is None:
            now = datetime.now(tz) if tz is not None else datetime.now()
        # Se já está exatamente em 20 ou 50, não dorme
        if now.minute in (20, 50) and now.second == 0 and now.microsecond == 0:
            return 0

        # Próximo alvo dentro da mesma hora: 20 ou 50
        if now.minute < 20:
            target = now.replace(minute=20, second=0, microsecond=0)
        elif now.minute < 50:
            target = now.replace(minute=50, second=0, microsecond=0)
        else:
            # Passou de 50, vai para a próxima hora no minuto 20
            target = (now + timedelta(hours=1)).replace(minute=20, second=0, microsecond=0)
        delta = int((target - now).total_seconds())
        return max(1, delta)
    except Exception:
        return 60

def get_first_value(sources, keys):
    if not isinstance(sources, (list, tuple)):
        sources = [sources]
    if not isinstance(keys, (list, tuple)):
        keys = [keys]
    for src in sources:
        if not isinstance(src, dict):
            continue
        for key in keys:
            if key is None:
                continue
            parts = key if isinstance(key, (list, tuple)) else [key]
            value = src
            valid = True
            for part in parts:
                if not isinstance(value, dict):
                    valid = False
                    break
                value = value.get(part)
            if not valid:
                continue
            if value is None:
                continue
            if isinstance(value, str) and value.strip() == '':
                continue
            return value
    return None

def pick_phone_entry(cli):
    if not isinstance(cli, dict):
        return {}
    tel_id = cli.get('telefone_id')
    tels = cli.get('telefones') or {}

    def first_dict(values):
        for v in values:
            if isinstance(v, dict):
                return v
        return {}

    if isinstance(tels, dict):
        if tel_id is not None:
            tel = tels.get(tel_id)
            if isinstance(tel, dict):
                return tel
        return first_dict(tels.values())

    if isinstance(tels, list):
        candidates = [t for t in tels if isinstance(t, dict)]
        if tel_id is not None:
            tel_id_str = str(tel_id)
            for tel in candidates:
                candidate_id = tel.get('telefone_id') or tel.get('id') or tel.get('telefoneId')
                if candidate_id is not None and str(candidate_id) == tel_id_str:
                    return tel
        return first_dict(candidates)

    return {}

def get_phone_field(phone_entry, keys):
    if not isinstance(phone_entry, dict):
        return None
    for key in keys:
        v = phone_entry.get(key)
        if v not in (None, ''):
            return v
    return None

def extract_banco_refinanciador(item, prop, averbacao):
    # Primary fallbacks across common locations/keys
    raw = get_first_value(
        [prop, averbacao, item],
        (
            'banco_refinanciador', 'bancoRefinanciador',
            'banco_refinanciador_nome', 'bancoRefinanciadorNome',
            'banco_refinanciado', 'banco_original',
            'banco_ref', 'bancoRef', 'banco_refin', 'banco_refi', 'banco_nome', 'bancoNome', 'banco'
        ),
    )
    if raw not in (None, ''):
        return raw
    # Check contratos list for any contract that looks like refinanciamento
    contratos = item.get('contratos') or []
    if isinstance(contratos, list):
        for c in contratos:
            if not isinstance(c, dict):
                continue
            mark = ' '.join(str(c.get(k, '')) for k in ('tipo','finalidade','descricao','operacao')).lower()
            if 'refin' in mark:
                cand = (
                    c.get('banco_refinanciador') or c.get('banco') or c.get('banco_nome') or c.get('bancoNome')
                )
                if cand not in (None, ''):
                    return cand
    # Check comissionamento as a last resort
    comiss = item.get('comissionamento') or {}
    if isinstance(comiss, dict):
        cand = comiss.get('banco_refinanciador') or comiss.get('banco') or comiss.get('banco_nome')
        if cand not in (None, ''):
            return cand
    return None


# ===== DB helpers =====
def conn_string():
    return (
        f"DRIVER={{{SQL['driver']}}};SERVER={SQL['server']},{SQL['port']};"
        f"DATABASE={SQL['database']};UID={SQL['user']};PWD={SQL['password']};TrustServerCertificate=YES;"
    )

def _set_cursor_timeout(cur, seconds=None):
    try:
        cur.timeout = int(seconds if seconds is not None else SQL.get('timeout', 600))
    except Exception:
        pass
    return cur

def _is_transient_odbc_error(err: Exception) -> bool:
    s = str(err)
    return (
        ('08S01' in s) or
        ('Communication link failure' in s) or
        ('TCP Provider' in s) or
        ('10060' in s)
    )

def connect_with_retry(max_attempts: int = 5, base_delay: float = 2.0):
    last = None
    for attempt in range(1, max_attempts + 1):
        try:
            return pyodbc.connect(conn_string(), autocommit=False, timeout=SQL['timeout'])
        except Exception as e:
            last = e
            try:
                log_error(f"Falha conectando ao SQL Server (tentativa {attempt}/{max_attempts}): {e}")
            except Exception:
                pass
            time.sleep(base_delay * attempt)
    if last:
        raise last
    raise RuntimeError('Falha desconhecida ao conectar ao SQL Server')

def ping_conn(conn) -> bool:
    try:
        cur = conn.cursor()
        _set_cursor_timeout(cur, 5)
        cur.execute("SELECT 1")
        cur.fetchone()
        return True
    except Exception:
        return False

def ensure_tables_and_indexes(conn):
    cur = conn.cursor()
    _set_cursor_timeout(cur)
    try:
        cur.execute(
            "IF OBJECT_ID('dbo.cadastrados_test','U') IS NOT NULL AND NOT EXISTS "
            "(SELECT 1 FROM sys.indexes WHERE name='IX_cadastrados_test_merge' AND object_id=OBJECT_ID('dbo.cadastrados_test')) "
            "CREATE INDEX IX_cadastrados_test_merge ON dbo.cadastrados_test "
            "(data_formalizacao, data_cadastro, cadastro, data_pagamento, pagamento, proposta_id);"
        )
        conn.commit()
    except Exception:
        try: conn.rollback()
        except Exception: pass


def insert_into_stage(conn, rows):
    if not rows:
        return 0
    cur = conn.cursor()
    _set_cursor_timeout(cur)
    cols = ', '.join(f'[{c}]' for c in columns)
    ph = ', '.join('?' for _ in columns)
    sql = f"INSERT INTO #cadastrados_stage ({cols}) VALUES ({ph})"
    batch = []
    total = 0
    for r in rows:
        vals = []
        for c in columns:
            if c in dateCols or c in bitCols or c == 'proposta_id':
                vals.append(r.get(c))
            else:
                vals.append(normalize_4000(r.get(c)))
        batch.append(tuple(vals))
        if len(batch) >= 500:
            cur.fast_executemany = True
            cur.executemany(sql, batch)
            conn.commit()
            total += len(batch)
            batch.clear()
    if batch:
        cur.fast_executemany = True
        cur.executemany(sql, batch)
        conn.commit()
        total += len(batch)
    return total


def merge_window_to_target(conn, sd: str, ed: str):
    t0 = time.perf_counter()
    data = fetch_api_window(sd, ed)
    t_fetch = (time.perf_counter() - t0) * 1000.0
    if not data:
        return {
            "inserted": 0,
            "skipped": True,
            "fetch_ms": t_fetch,
            "stage_ins_ms": 0.0,
            "stage_dedup_ms": 0.0,
            "merge_ms": 0.0,
        }
    cur = conn.cursor()
    _set_cursor_timeout(cur)
    columns_definition = columns_definition_sql()
    cur.execute(
        f"""
IF OBJECT_ID('tempdb..#cadastrados_stage') IS NOT NULL DROP TABLE #cadastrados_stage;
CREATE TABLE #cadastrados_stage (
    {columns_definition}
);
"""
    )
    conn.commit()
    t1 = time.perf_counter()
    ins = insert_into_stage(conn, data)
    t2 = time.perf_counter()
    dedup_sql = f"""
;WITH ranked AS (
  SELECT {', '.join('['+c+']' for c in columns)},
         ROW_NUMBER() OVER (
           PARTITION BY {', '.join(f"LTRIM(RTRIM(ISNULL([{k}],'')))" for k in MERGE_KEYS)}
           ORDER BY (SELECT 0)
         ) AS rn
  FROM #cadastrados_stage
)
DELETE FROM ranked WHERE rn > 1;
"""
    cur.execute(dedup_sql)
    conn.commit()
    t3 = time.perf_counter()
    cols_list = ', '.join('['+c+']' for c in columns)
    set_clause = ', '.join(f"t.[{c}] = s.[{c}]" for c in columns)
    on_clause = ' AND '.join(
        f"LTRIM(RTRIM(ISNULL(t.[{k}],''))) = LTRIM(RTRIM(ISNULL(s.[{k}],'')))"
        for k in MERGE_KEYS
    )
    merge_sql = f"""
MERGE dbo.cadastrados_test AS t
USING #cadastrados_stage AS s
ON {on_clause}
WHEN MATCHED THEN
  UPDATE SET {set_clause}
WHEN NOT MATCHED BY TARGET THEN
  INSERT ({cols_list}) VALUES ({', '.join('s.['+c+']' for c in columns)});
"""
    cur.execute(merge_sql)
    conn.commit()
    t4 = time.perf_counter()
    return {
        "inserted": ins,
        "skipped": False,
        "fetch_ms": t_fetch,
        "stage_ins_ms": (t2 - t1) * 1000.0,
        "stage_dedup_ms": (t3 - t2) * 1000.0,
        "merge_ms": (t4 - t3) * 1000.0,
    }
# ===== API fetch =====
def fetch_api_window(sd: str, ed: str):
    combined = []
    for entry in EMPRESAS:
        payload = {
            "auth": {"username": entry["username"], "password": entry["password"], "empresa": entry["empresa"]},
            "requestType": "getPropostas",
            "filters": {"data": {"tipo": "cadastro", "startDate": sd, "endDate": ed}}
        }
        try:
            rsp = requests.post(entry["url"], json=payload, headers={"Content-Type":"application/json"}, timeout=30)
            status = rsp.status_code
            log_info(f"STATUS empresa={entry.get('empresa')} status={status} janela={sd}->{ed}")
            if status != 200:
                continue
            try:
                data = rsp.json() if rsp.content else {}
            except Exception as je:
                log_error(f"API {entry['empresa']} 200 JSON parse error {sd}->{ed}: {je}")
                continue
            items = data if isinstance(data, list) else (list(data.values()) if isinstance(data, dict) else [])
            for item in items:
                # removed per-item sleep
                if not item or not isinstance(item, dict):
                    continue
                datas = item.get('datas', {}) or {}
                api = item.get('api', {}) or {}
                averbacao = item.get('averbacao', {}) or {}
                prop = item.get('proposta', {}) or {}
                cli = item.get('cliente', {}) or {}
                end = cli.get('endereco', {}) or {}
                phone_entry = pick_phone_entry(cli)
                phone_ddd_raw = get_phone_field(phone_entry, ('ddd','telefone_ddd','prefixo','prefix','area','ddd_telefone'))
                phone_number_raw = get_phone_field(phone_entry, ('numero','telefone','telefone_numero','numero_telefone','celular','fone','numeroTelefone'))
                agencia_digito_raw = get_first_value(averbacao, ('agencia_digito','agencia_dv','agenciaDv','agenciaDigito'))
                data_formalizacao_raw = get_first_value([datas, prop, item], ('data_formalizacao','formalizacao','dataFormalizacao'))
                data_pagamento_raw = get_first_value([datas, prop, item], ('data_pagamento','pagamento','dataPagamento'))
                data_status_api_raw = get_first_value([api, prop, item], ('data_status_api','dataStatusApi','data_status','dataStatus'))
                vendedor_participante_raw = get_first_value([item, prop], ('vendedor_participante','vendedorParticipante','vendedor_secundario','vendedorSecundario'))
                enviado_quali_raw = get_first_value([prop, item], ('enviado_quali','enviando_quali','enviadoQuali','enviandoQuali'))

                proposta_id_raw = prop.get('proposta_id')
                proposta_id_val = None if proposta_id_raw in (None, '', []) else str(proposta_id_raw).strip()

                # Fallback helpers
                cep_val = normalize_digits(cli.get('cep') or end.get('cep'), LENGTH_LIMITS['cep'])
                cidade_val = normalize_value_text(cli.get('cidade') or end.get('cidade') or end.get('municipio'))
                uf_val = normalize_uf(cli.get('estado') or end.get('estado') or cli.get('uf'))
                banco_refin_raw = extract_banco_refinanciador(item, prop, averbacao)
                beneficio_raw = get_first_value([cli, item, prop], ('beneficio','beneficio_id','beneficioId'))
                id_prop_banco_raw = get_first_value([prop, item], ('id_proposta_banco','proposta_id_banco','idPropostaBanco'))
                substatus_raw = get_first_value([item, api, prop], ('substatus','subStatus','sub_status','status_sub'))
                status_nome_raw = get_first_value([item, api, prop], ('status_nome','statusNome','status_name','statusDescricao','statusDescricao'))
                usuariobanco_raw = get_first_value([prop, api, item], ('usuariobanco','usuario_banco','usuarioBanco'))
                indicacao_id_raw = get_first_value([item, prop], ('indicacao_id','indicacaoId','id_indicacao'))
                vendedor_part_nome_raw = get_first_value([item, prop], ('vendedor_participante_nome','vendedorParticipanteNome','nome_vendedor_participante'))
                formalizador_raw = get_first_value([item, prop], ('formalizador','formalizador_id','formalizadorId'))
                formalizador_nome_raw = get_first_value([item, prop], ('formalizador_nome','formalizadorNome','nome_formalizador'))

                row = {
                  'empresa': normalize_value_text(entry.get('empresa')) if entry.get('empresa') is not None else DEFAULT_MISSING,
                  'data_formalizacao': parse_date_or_none(data_formalizacao_raw, only_date=True),
                  'data_cadastro': parse_date_or_none(datas.get('cadastro'), only_date=True),
                  'cadastro': parse_date_or_none(datas.get('cadastro'), only_date=True),
                  'data_pagamento': parse_date_or_none(data_pagamento_raw, only_date=True),
                  'pagamento': parse_date_or_none(data_pagamento_raw, only_date=True),
                  'data_status_api': parse_date_or_none(data_status_api_raw, only_date=True),
                  'data_atualizacao_api': parse_date_or_none(api.get('data_atualizacao_api'), only_date=True),
                  'dt_ultima_tentativa_api': parse_date_or_none(api.get('dt_ultima_tentativa_api'), only_date=True),
                  'status_api': normalize_value_text(api.get('status_api')),
                  'status_api_descricao': normalize_value_text(api.get('status_api_descricao') or status_nome_raw),
                  'banco_averbacao': normalize_value_text(averbacao.get('banco_averbacao') if averbacao.get('banco_averbacao') not in (None, '') else 0),
                  'agencia': normalize_4000(averbacao.get('agencia')),
                  'agencia_digito': normalize_digits(agencia_digito_raw, LENGTH_LIMITS['agencia_digito']),
                  'conta': normalize_4000(averbacao.get('conta')),
                  'conta_digito': normalize_4000(averbacao.get('conta_digito')),
                  'pix': '1' if (averbacao.get('pix') in (True, 1, '1', 'true', 'True')) else ('0' if averbacao.get('pix') not in (None, '') else None),
                  'tipo_liberacao': normalize_value_text(averbacao.get('tipo_liberacao')),
                  'inclusao': parse_date_or_none(datas.get('inclusao'), only_date=True),
                  'cancelado': parse_date_or_none(datas.get('cancelado'), only_date=True),
                  'concluido': parse_date_or_none(datas.get('concluido'), only_date=True),
                  'averbacao': parse_date_or_none(datas.get('averbacao'), only_date=True),
                  'retorno_saldo': parse_date_or_none(datas.get('retorno_saldo'), only_date=True),
                  'banco_id': normalize_value_text(prop.get('banco_id')),
                  'banco_nome': normalize_value_text(prop.get('banco_nome')),
                  'convenio_id': normalize_value_text(prop.get('convenio_id')),
                  'convenio_nome': normalize_value_text(prop.get('convenio_nome')),
                  'link_formalizacao': normalize_value_text(prop.get('link_formalizacao')),
                  'orgao': normalize_value_text(prop.get('orgao')),
                  'prazo': normalize_value_text(prop.get('prazo')),
                  'promotora_id': normalize_value_text(prop.get('promotora_id')),
                  'promotora_nome': normalize_value_text(prop.get('promotora_nome')),
                  'produto_id': normalize_value_text(prop.get('produto_id')),
                  'produto_nome': normalize_value_text(prop.get('produto_nome')),
                  'proposta_id': proposta_id_val,
                  'proposta_id_banco': normalize_value_text(prop.get('proposta_id_banco') or id_prop_banco_raw),
                  'proposta_reference_api': normalize_value_text(prop.get('proposta_reference_api')),
                  'valor_financiado': normalize_value_text(prop.get('valor_financiado')),
                  'valor_liberado': normalize_value_text(prop.get('valor_liberado')),
                  'valor_parcela': normalize_value_text(prop.get('valor_parcela')),
                  'valor_referencia': normalize_value_text(prop.get('valor_referencia')),
                  'valor_meta': normalize_value_text(prop.get('valor_meta')),
                  'valor_total_comissionado': normalize_value_text(prop.get('valor_total_comissionado')),
                  'valor_total_repassado_vendedor': normalize_value_text(prop.get('valor_total_repassado_vendedor')),
                  'valor_total_estornado': normalize_value_text(prop.get('valor_total_estornado')),
                  'valor_total_comissao_liq': normalize_value_text(prop.get('valor_total_comissao_liq')),
                  'valor_total_comissao_franquia': normalize_value_text(prop.get('valor_total_comissao_franquia')),
                  'valor_total_repasse_franquia': normalize_value_text(prop.get('valor_total_repasse_franquia')),
                  'tabela_id': normalize_value_text(prop.get('tabela_id')),
                  'tabela_nome': normalize_value_text(prop.get('tabela_nome')),
                  'flag_aumento': '1' if (prop.get('flag_aumento') in (True, 1, '1', 'true', 'True')) else ('0' if prop.get('flag_aumento') not in (None, '') else None),
                  'srcc': '1' if (prop.get('srcc') in (True, 1, '1', 'true', 'True')) else ('0' if prop.get('srcc') not in (None, '') else None),
                  'seguro': '1' if (prop.get('seguro') in (True, 1, '1', 'true', 'True')) else ('0' if prop.get('seguro') not in (None, '') else None),
                  'proposta_duplicada': '1' if (prop.get('proposta_duplicada') in (True, 1, '1', 'true', 'True')) else ('0' if prop.get('proposta_duplicada') not in (None, '') else None),
                  'taxa': normalize_value_text(prop.get('taxa')),
                  'usuariobanco': normalize_value_text(usuariobanco_raw),
                  'franquia_id': normalize_value_text(prop.get('franquia_id')),
                  'indicacao_id': normalize_value_text(indicacao_id_raw),
                  'enviado_quali': '1' if (enviado_quali_raw in (True, 1, '1', 'true', 'True')) else ('0' if enviado_quali_raw not in (None, '') else None),
                  'equipe_id': normalize_value_text(item.get('equipe_id')),
                  'equipe_nome': normalize_value_text(item.get('equipe_nome')),
                  'franquia_nome': normalize_value_text(item.get('franquia_nome')),
                  'origem': normalize_value_text(item.get('origem')),
                  'origem_id': normalize_value_text(item.get('origem_id')),
                  'status_id': normalize_value_text(item.get('status_id')),
                  'substatus': normalize_value_text(substatus_raw),
                  'status_nome': normalize_value_text(status_nome_raw),
                  'tipo_cadastro': normalize_value_text(item.get('tipo_cadastro')),
                  'usuario_id': normalize_value_text(item.get('usuario_id')),
                  'vendedor_nome': normalize_value_text(item.get('vendedor_nome')),
                  'vendedor_id': normalize_value_text(item.get('vendedor_id')),
                  'digitador_id': normalize_value_text(item.get('digitador_id')),
                  'digitador_nome': normalize_value_text(item.get('digitador_nome')),
                  'vendedor_cargo_id': normalize_value_text(item.get('vendedor_cargo_id')),
                  'vendedor_participante': '1' if (vendedor_participante_raw in (True, 1, '1', 'true', 'True')) else ('0' if vendedor_participante_raw not in (None, '') else None),
                  'vendedor_participante_nome': normalize_value_text(vendedor_part_nome_raw),
                  'formalizador': normalize_value_text(formalizador_raw),
                  'formalizador_nome': normalize_value_text(formalizador_nome_raw),
                  'cliente_id': normalize_value_text(cli.get('cliente_id')),
                  'cliente_cpf': normalize_value_text(cli.get('cliente_cpf') or cli.get('cpf') or cli.get('documento')),
                  'cliente_sexo': normalize_value_text(cli.get('cliente_sexo')),
                  'nascimento': parse_date_or_none(cli.get('nascimento'), only_date=True),
                  'analfabeto': '1' if (cli.get('analfabeto') in (True, 1, '1', 'true', 'True')) else ('0' if cli.get('analfabeto') not in (None, '') else None),
                  'nao_perturbe': '1' if (cli.get('nao_perturbe') in (True, 1, '1', 'true', 'True')) else ('0' if cli.get('nao_perturbe') not in (None, '') else None),
                  'cliente_nome': normalize_value_text(cli.get('cliente_nome')),
                  'cep': cep_val,
                  'cidade': cidade_val,
                  'estado': uf_val,
                  'telefone_id': normalize_value_text(cli.get('telefone_id')),
                  'documento_id': normalize_value_text(cli.get('documento_id')),
                  'beneficio_id': normalize_value_text(cli.get('beneficio_id')),
                  'endereco_id': normalize_value_text(cli.get('endereco_id')),
                  'matricula': normalize_value_text(cli.get('matricula') or cli.get('beneficio')),
                  'nome_mae': normalize_value_text(cli.get('nome_mae')),
                  'renda': normalize_value_text(cli.get('renda')),
                  'especie': normalize_value_text(cli.get('especie')),
                  'ddb': normalize_value_text(cli.get('ddb')),
                  'possui_representante': '1' if (cli.get('possui_representante') in (True, 1, '1', 'true', 'True')) else ('0' if cli.get('possui_representante') not in (None, '') else None),
                  'logradouro': normalize_value_text(end.get('logradouro')),
                  'endereco_numero': normalize_value_text(end.get('endereco_numero')),
                  'bairro': normalize_value_text(end.get('bairro')),
                  'telefone_ddd': normalize_digits(phone_ddd_raw, LENGTH_LIMITS['telefone_ddd']),
                  'telefone_numero': normalize_digits(phone_number_raw, LENGTH_LIMITS['telefone_numero']),
                  'banco_refinanciador': normalize_value_text(banco_refin_raw),
                  'beneficio': normalize_value_text(beneficio_raw),
                  'id_proposta_banco': normalize_value_text(id_prop_banco_raw),
                }
                combined.append(row)
            time.sleep(0.1)
        except Exception as e:
            log_error(f"Erro API {entry['empresa']}: {e}")
            time.sleep(0.2)
    log_info(f"Coletado {len(combined)} registros para {sd}->{ed}")
    return combined


# ===== OrquestraÃ§Ã£o =====
def process_window(conn, sd: str, ed: str):
    merge_window_to_target(conn, sd, ed)


def load_state(base_date: datetime.date, today: datetime.date) -> datetime.date:
    try:
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        cursor_str = data.get('cursor')
        if cursor_str:
            c = datetime.strptime(cursor_str, '%Y-%m-%d').date()
            if c < base_date or c > today:
                return base_date
            return c
    except Exception:
        pass
    return base_date

def save_state(cursor_date: datetime.date) -> None:
    try:
        with open(STATE_FILE, 'w', encoding='utf-8') as f:
            json.dump({'cursor': cursor_date.strftime('%Y-%m-%d')}, f)
    except Exception:
        pass

def run_loop():
    conn = connect_with_retry()
    ensure_tables_and_indexes(conn)

    while True:
        # Janela de execucao (seg-sab 07:50-20:50, TZ configuravel)
        try:
            from dateutil import tz as _tz
            _tzobj = _tz.gettz(RT_TZ)
            now_local = datetime.now(_tzobj)
            sh, sm = [int(x) for x in RT_WINDOW_START.split(':')]
            eh, em = [int(x) for x in RT_WINDOW_END.split(':')]
            in_weekday = (now_local.weekday() <= 5) if RT_WEEKDAYS_ONLY else True
            in_hours = ((now_local.hour, now_local.minute) >= (sh, sm)) and ((now_local.hour, now_local.minute) <= (eh, em))
            if not (in_weekday and in_hours):
                log_info("Fora da janela (seg-sab %02d:%02d-%02d:%02d, %s), dormindo %ss" % (sh, sm, eh, em, RT_TZ, LOOP_SLEEP_SECONDS))
                time.sleep(LOOP_SLEEP_SECONDS)
                continue
        except Exception as _se:
            log_error("Erro scheduler: %s" % (_se,))
        try:
            # Garante conexão viva antes de operar
            if not ping_conn(conn):
                log_error("Conexão SQL inativa. Recriando...")
                try:
                    conn.close()
                except Exception:
                    pass
                conn = connect_with_retry()

            today = datetime.now().date()
            base_date = today - timedelta(days=90)
            total_windows = 0
            tmp = base_date
            while tmp <= today:
                first_of_month = tmp.replace(day=1)
                next_month = (first_of_month.replace(day=28) + timedelta(days=4)).replace(day=1)
                last_day = next_month - timedelta(days=1)

                if tmp.day <= 15:
                    ed_candidate = first_of_month.replace(day=15) if last_day.day >= 15 else last_day
                else:
                    ed_candidate = last_day

                if ed_candidate > today:
                    ed_candidate = today

                total_windows += 1
                tmp = ed_candidate + timedelta(days=1)
            cycle_start = time.perf_counter()
            d = base_date
            window_counter = 0
            while d <= today:
                # janela quinzenal correta: 1-15 e 16-último dia do mês
                first_of_month = d.replace(day=1)
                next_month = (first_of_month.replace(day=28) + timedelta(days=4)).replace(day=1)
                last_day = next_month - timedelta(days=1)

                if d.day <= 15:
                    sd_date = first_of_month
                    ed_candidate = first_of_month.replace(day=15) if last_day.day >= 15 else last_day
                else:
                    sd_date = first_of_month.replace(day=16)
                    ed_candidate = last_day

                if ed_candidate > today:
                    ed_candidate = today

                sd = sd_date.strftime('%Y-%m-%d')
                ed = ed_candidate.strftime('%Y-%m-%d')
                window_counter += 1
                process_window(conn, sd, ed)
                elapsed = time.perf_counter() - cycle_start
                remaining = total_windows - window_counter
                avg = elapsed / window_counter if window_counter > 0 else 0
                eta_s = avg * remaining
                log_info(f"PROGRESS {format_progress(window_counter, total_windows)} janela={sd}->{ed} ETA={format_eta(eta_s)}")
                d = ed_candidate + timedelta(days=1)
            log_info(f"Ciclo completo. Aguardando {LOOP_SLEEP_SECONDS}s antes de reiniciar.")
            time.sleep(LOOP_SLEEP_SECONDS)
            continue
        except Exception as e:
            log_error(f"Erro no loop: {e}")
            try:
                conn.rollback()
            except Exception:
                pass
            # Se for uma falha transitória de link (08S01), fecha e reconecta
            try:
                import pyodbc as _py
                is_odbc = isinstance(e, _py.Error) or 'pyodbc' in type(e).__module__
            except Exception:
                is_odbc = False
            if is_odbc and _is_transient_odbc_error(e):
                try:
                    conn.close()
                except Exception:
                    pass
                log_info("Reconectando ao SQL Server após falha 08S01...")
                conn = connect_with_retry()
        # Alinha próxima execução para 0/30 minutos dentro da janela
        try:
            from dateutil import tz as _tz
            _tzobj = _tz.gettz(RT_TZ)
        except Exception:
            _tzobj = None
        try:
            now_local = datetime.now(_tzobj) if _tzobj else datetime.now()
            sh, sm = [int(x) for x in RT_WINDOW_START.split(':')]
            eh, em = [int(x) for x in RT_WINDOW_END.split(':')]
            in_weekday = (now_local.weekday() <= 5) if RT_WEEKDAYS_ONLY else True
            in_hours = ((now_local.hour, now_local.minute) >= (sh, sm)) and ((now_local.hour, now_local.minute) <= (eh, em))
            if in_weekday and in_hours:
                sleep_s = seconds_until_next_half_hour(now_local, _tzobj)
                log_info(f"Aguardando próximo alinhamento 20/50 em {sleep_s}s")
                time.sleep(sleep_s)
        except Exception as _se2:
            log_error(f"Erro ao alinhar para próxima meia hora: {_se2}")


if __name__ == "__main__":
    run_loop()
