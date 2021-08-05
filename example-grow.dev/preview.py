#! /usr/bin/python3

from grow.server import main
import subprocess

CONTENT_TYPES_TO_SYNC = ['html', 'json']


def sync_git(branch):
    subprocess.call(['npx', 'preview', 'sync', '-b', branch])


def patched_wsgi_app(self, environ, start_response):
    for item in CONTENT_TYPES_TO_SYNC:
        if item in environ['HTTP_ACCEPT']:
            sync_git(environ['BRANCH'])
            break
    return main.PodServer.original_wsgi_app(self, environ, start_response)


def patch_pod_server():
    main.PodServer.original_wsgi_app = main.PodServer.wsgi_app
    main.PodServer.wsgi_app = patched_wsgi_app

# Grow's `bin/grow`.

import logging
import sys
import os

logging.basicConfig(level=logging.INFO, format='%(message)s')

sys.path.extend(
    [os.path.join(os.path.dirname(os.path.realpath(__file__)), '..')])

from grow import commands
from grow.commands import group

commands.add_subcommands(group.grow)

if __name__ == '__main__':
    patch_pod_server()
    group.grow()
