#!/bin/bash

cd $(dirname "$0")
export PATH=$PATH:./node_modules

electron .
