const { type, name } = $arguments

let config = JSON.parse($files[0])
let proxies = await produceArtifact({
  name,
  type: /^1$|col/i.test(type) ? 'collection' : 'subscription',
  platform: 'sing-box',
  produceType: 'internal',
})

function action_keywords(nodes, action, keywords) {
    let temp_nodes = [];
    let flag = false;
    if (action === 'exclude') {
        flag = true;
    }

    // 空关键字过滤
    const combined_pattern = keywords.join('|');
    if (!combined_pattern || /^\s*$/.test(combined_pattern)) {
        return nodes;
    }

    const compiled_pattern = new RegExp(combined_pattern);

    for (const node of nodes) {
        const name = node.tag;
        const match_flag = compiled_pattern.test(name);
        if (match_flag ^ flag) {
            temp_nodes.push(node);
        }
    }

    return temp_nodes;
}

function nodes_filter(nodes, filter) {
    for (const a of filter) {
        if (a.for) {
            continue;
        }
        nodes = action_keywords(nodes, a.action, a.keywords);
    }
    return nodes;
}

function pro_node_template(data_nodes, config_outbound) {
    if (config_outbound.filter) {
        data_nodes = nodes_filter(data_nodes, config_outbound.filter);
    }
    return data_nodes.map(node => node.tag);
}

function combin_to_config(config, data) {
    const config_outbounds = config.outbounds || [];
    const temp_outbounds = [];

    for (const po of config_outbounds) {
        if (po.outbounds) {
            let o1 = [];
            for (const item of po.outbounds) {
                if (item.startsWith('{') && item.endsWith('}')) {
                    const _item = item.slice(1, -1);
                    if (_item === 'all') {
                        o1.push(item);
                    }
                } else {
                    o1.push(item);
                }
            }
            po.outbounds = o1;

            const t_o = [];
            const check_dup = new Set();
            for (const oo of po.outbounds) {
                if (check_dup.has(oo)) continue;
                check_dup.add(oo);

                if (oo.startsWith('{') && oo.endsWith('}')) {
                    const groupKey = oo.slice(1, -1);
                    if (groupKey === 'all') {
                      t_o.push(...pro_node_template(data, po));
                    }
                } else {
                    t_o.push(oo);
                }
            }

            if (t_o.length === 0) {
                t_o.push('Proxy');
                console.error(`发现 ${po.tag} 出站下的节点数量为 0 ，会导致sing-box无法运行，请检查config模板是否正确。`);
            }
            po.outbounds = t_o;
            delete po.filter;
        }
    }

    temp_outbounds.push(...data);

    config.outbounds = [...config_outbounds, ...temp_outbounds];

    // 处理DNS规则
    const dns_tags = config.dns.servers.map(server => server.tag);
    // const asod = providers.auto_set_outbounds_dns;
    // if (asod && asod.proxy && asod.direct && 
    //     dns_tags.includes(asod.proxy) && dns_tags.includes(asod.direct)) {
    //     set_proxy_rule_dns(config);
    // }

    // 处理WireGuard
    const wireguard_items = config.outbounds.filter(item => item.type === 'wireguard');
    if (wireguard_items.length > 0) {
        config.endpoints = wireguard_items;
        config.outbounds = config.outbounds.filter(item => item.type !== 'wireguard');
    }

    return config;
}

config = combin_to_config(config, proxies)

$content = JSON.stringify(config, null, 2)

function getTags(proxies, regex) {
  return (regex ? proxies.filter(p => regex.test(p.tag)) : proxies).map(p => p.tag)
}
