from alembic import context
from sqlalchemy import engine_from_config, pool
from mofip.database import Base
from mofip import models  # noqa: F401

config = context.config
target_metadata = Base.metadata
with engine_from_config(config.get_section(config.config_ini_section), prefix="sqlalchemy.", poolclass=pool.NullPool).connect() as connection:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction(): context.run_migrations()
