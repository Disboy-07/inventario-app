import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

// ── Parseo de comandos de texto ──────────────────────────────────────────────
const parseCommand = (input) => {
  const nuevoMatch = input.match(/nuevo articulo:([^;]+);([\d.]+)\$?\s*(.*)/i);
  if (nuevoMatch) return { type: "new", name: nuevoMatch[1].trim(), price: parseFloat(nuevoMatch[2]), specs: nuevoMatch[3].trim() };

  const precioMatch = input.match(/precio:([^;]+);([\d.]+)/i);
  if (precioMatch) return { type: "price", name: precioMatch[1].trim(), price: parseFloat(precioMatch[2]) };

  const stockMatch = input.match(/stock:([^;]+);([+-]?\d+)/i);
  if (stockMatch) return { type: "stock", name: stockMatch[1].trim(), qty: parseInt(stockMatch[2]) };

  const ventaMatch = input.match(/venta:([^;]+);(\d+)/i);
  if (ventaMatch) return { type: "sale", name: ventaMatch[1].trim(), qty: parseInt(ventaMatch[2]) };

  const borrarMatch = input.match(/borrar:(.+)/i);
  if (borrarMatch) return { type: "delete", name: borrarMatch[1].trim() };

  return null;
};

// ── Estilos globales ─────────────────────────────────────────────────────────
const G = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0a; }
  ::-webkit-scrollbar { width: 4px; } 
  ::-webkit-scrollbar-track { background: #111; } 
  ::-webkit-scrollbar-thumb { background: #c8a84b; }
  .nav-btn { background: none; border: none; cursor: pointer; padding: 10px 22px; font-family: inherit; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #555; transition: all 0.2s; border-bottom: 2px solid transparent; }
  .nav-btn.active { color: #c8a84b; border-bottom-color: #c8a84b; }
  .nav-btn:hover { color: #c8a84b; }
  .card { background: #111; border: 1px solid #222; border-radius: 2px; padding: 16px; transition: border-color 0.2s; }
  .card:hover { border-color: #c8a84b44; }
  .badge { display: inline-block; padding: 3px 9px; font-size: 10px; letter-spacing: 2px; border-radius: 2px; }
  .ok  { background: #1a2a1a; color: #4caf50; border: 1px solid #2a4a2a; }
  .warn{ background: #2a2a1a; color: #f0c040; border: 1px solid #4a4a1a; }
  .err { background: #2a1a1a; color: #f04040; border: 1px solid #4a1a1a; }
  input, select, textarea { background: #161616; border: 1px solid #2a2a2a; color: #e8e0d0; font-family: inherit; padding: 10px 14px; font-size: 13px; outline: none; border-radius: 2px; width: 100%; }
  input:focus, select:focus { border-color: #c8a84b; }
  .btn { background: #c8a84b; color: #0a0a0a; border: none; cursor: pointer; padding: 10px 22px; font-family: 'Courier New', monospace; font-size: 11px; letter-spacing: 2px; font-weight: bold; border-radius: 2px; transition: opacity 0.2s; }
  .btn:hover { opacity: 0.82; }
  .btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .btn-ghost { background: transparent; color: #c8a84b; border: 1px solid #c8a84b44; }
  .btn-ghost:hover { background: #c8a84b11; }
  .btn-red { background: #4a1a1a; color: #f04040; border: 1px solid #6a1a1a; }
  .btn-red:hover { background: #5a1a1a; }
  .feedback { position: fixed; top: 16px; right: 16px; padding: 12px 20px; border-radius: 2px; font-size: 13px; z-index: 9999; max-width: 360px; animation: sli 0.2s ease; }
  @keyframes sli { from { opacity:0; transform: translateY(-8px); } to { opacity:1; transform: translateY(0); } }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
  .item-photo { width: 100%; height: 130px; object-fit: cover; border-radius: 2px; margin-bottom: 10px; }
  .item-no-photo { width: 100%; height: 80px; background: #161616; border-radius: 2px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #333; font-size: 10px; letter-spacing: 2px; cursor: pointer; transition: background 0.2s; }
  .item-no-photo:hover { background: #1e1e1e; color: #c8a84b; }
  .cmd-help { color: #444; font-size: 11px; line-height: 2; margin-top: 10px; }
  .cmd-help span { color: #c8a84b; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 10px 12px; font-size: 10px; letter-spacing: 3px; color: #555; border-bottom: 1px solid #1a1a1a; }
  td { padding: 11px 12px; font-size: 13px; border-bottom: 1px solid #131313; vertical-align: middle; }
  tr:hover td { background: #0e0e0e; }
  .stat-card { background: #111; border: 1px solid #1e1e1e; border-radius: 2px; padding: 20px; text-align: center; }
  .qty-input { width: 60px; text-align: center; padding: 6px; font-size: 14px; }
  .venta-row { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid #151515; }
  .venta-row:last-child { border-bottom: none; }
  .loader { display: inline-block; width: 14px; height: 14px; border: 2px solid #333; border-top-color: #c8a84b; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

export default function App() {
  const [page, setPage] = useState("stock");
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cmd, setCmd] = useState("");
  const [cmdLoading, setCmdLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [search, setSearch] = useState("");
  const [ventaCarrito, setVentaCarrito] = useState({}); // { id: qty }
  const [ventaLoading, setVentaLoading] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const fileRef = useRef();
  const [photoTarget, setPhotoTarget] = useState(null);

  const flash = (msg, type = "ok") => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  // ── Cargar productos ───────────────────────────────────────────────────────
  const loadProductos = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("productos").select("*").order("nombre");
    if (!error) setProductos(data || []);
    else flash("Error cargando productos: " + error.message, "err");
    setLoading(false);
  };

  // ── Cargar historial de ventas ─────────────────────────────────────────────
  const loadHistorial = async () => {
    setHistLoading(true);
    const { data, error } = await supabase
      .from("ventas")
      .select("*, productos(nombre)")
      .order("fecha", { ascending: false })
      .limit(50);
    if (!error) setHistorial(data || []);
    setHistLoading(false);
  };

  useEffect(() => { loadProductos(); }, []);
  useEffect(() => { if (page === "ventas") loadHistorial(); }, [page]);

  // ── Ejecutar comando de texto ──────────────────────────────────────────────
  const handleCmd = async () => {
    const parsed = parseCommand(cmd);
    if (!parsed) {
      flash("Comando no reconocido", "err");
      return;
    }
    setCmdLoading(true);

    try {
      if (parsed.type === "new") {
        const { error } = await supabase.from("productos").insert({
          nombre: parsed.name, precio: parsed.price, specs: parsed.specs, stock: 0
        });
        if (error) throw error;
        flash(`✓ "${parsed.name}" creado a $${parsed.price.toLocaleString()}`);
      }

      if (parsed.type === "price") {
        const prod = productos.find(p => p.nombre.toLowerCase() === parsed.name.toLowerCase());
        if (!prod) { flash(`No encontré "${parsed.name}"`, "err"); setCmdLoading(false); return; }
        const { error } = await supabase.from("productos").update({ precio: parsed.price }).eq("id", prod.id);
        if (error) throw error;
        flash(`✓ Precio de "${prod.nombre}" → $${parsed.price.toLocaleString()}`);
      }

      if (parsed.type === "stock") {
        const prod = productos.find(p => p.nombre.toLowerCase() === parsed.name.toLowerCase());
        if (!prod) { flash(`No encontré "${parsed.name}"`, "err"); setCmdLoading(false); return; }
        const nuevoStock = Math.max(0, (prod.stock || 0) + parsed.qty);
        const { error } = await supabase.from("productos").update({ stock: nuevoStock }).eq("id", prod.id);
        if (error) throw error;
        flash(`✓ Stock "${prod.nombre}" → ${nuevoStock} unidades`);
      }

      if (parsed.type === "sale") {
        const prod = productos.find(p => p.nombre.toLowerCase() === parsed.name.toLowerCase());
        if (!prod) { flash(`No encontré "${parsed.name}"`, "err"); setCmdLoading(false); return; }
        if ((prod.stock || 0) < parsed.qty) { flash(`Stock insuficiente (hay ${prod.stock})`, "err"); setCmdLoading(false); return; }
        const nuevoStock = prod.stock - parsed.qty;
        await supabase.from("productos").update({ stock: nuevoStock, ventas: (prod.ventas || 0) + parsed.qty }).eq("id", prod.id);
        await supabase.from("ventas").insert({ producto_id: prod.id, cantidad: parsed.qty, precio_unitario: prod.precio, total: prod.precio * parsed.qty });
        flash(`✓ Venta: ${parsed.qty}x "${prod.nombre}" | Quedan: ${nuevoStock}`);
      }

      if (parsed.type === "delete") {
        const prod = productos.find(p => p.nombre.toLowerCase() === parsed.name.toLowerCase());
        if (!prod) { flash(`No encontré "${parsed.name}"`, "err"); setCmdLoading(false); return; }
        const { error } = await supabase.from("productos").delete().eq("id", prod.id);
        if (error) throw error;
        flash(`✓ "${prod.nombre}" eliminado`);
      }

      await loadProductos();
      setCmd("");
    } catch (e) {
      flash("Error: " + e.message, "err");
    }
    setCmdLoading(false);
  };

  // ── Subir foto ─────────────────────────────────────────────────────────────
  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file || !photoTarget) return;
    const ext = file.name.split(".").pop();
    const path = `${photoTarget}.${ext}`;
    // Subir a Supabase Storage (bucket: "fotos") — crear el bucket en Supabase si no existe
    const { error: upErr } = await supabase.storage.from("fotos").upload(path, file, { upsert: true });
    if (upErr) { flash("Error subiendo foto: " + upErr.message, "err"); return; }
    const { data } = supabase.storage.from("fotos").getPublicUrl(path);
    await supabase.from("productos").update({ foto_url: data.publicUrl }).eq("id", photoTarget);
    flash("✓ Foto subida");
    setPhotoTarget(null);
    await loadProductos();
  };

  // ── Registrar venta desde carrito ──────────────────────────────────────────
  const registrarVenta = async () => {
    const items = Object.entries(ventaCarrito).filter(([, q]) => q > 0);
    if (items.length === 0) { flash("Agregá productos al carrito", "err"); return; }
    setVentaLoading(true);
    try {
      for (const [id, qty] of items) {
        const prod = productos.find(p => p.id === id);
        if (!prod) continue;
        if ((prod.stock || 0) < qty) { flash(`Stock insuficiente en "${prod.nombre}"`, "err"); setVentaLoading(false); return; }
        const nuevoStock = prod.stock - qty;
        await supabase.from("productos").update({ stock: nuevoStock, ventas: (prod.ventas || 0) + qty }).eq("id", id);
        await supabase.from("ventas").insert({ producto_id: id, cantidad: qty, precio_unitario: prod.precio, total: prod.precio * qty });
      }
      flash(`✓ Venta registrada — ${items.length} producto(s)`);
      setVentaCarrito({});
      await loadProductos();
      await loadHistorial();
    } catch (e) {
      flash("Error: " + e.message, "err");
    }
    setVentaLoading(false);
  };

  const totalCarrito = Object.entries(ventaCarrito).reduce((s, [id, q]) => {
    const p = productos.find(x => x.id === id);
    return s + (p ? p.precio * q : 0);
  }, 0);

  const filtered = productos.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()));

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily: "'Courier New', monospace", background: "#0a0a0a", minHeight: "100vh", color: "#e8e0d0" }}>
      <style>{G}</style>

      {/* NAV */}
      <div style={{ borderBottom: "1px solid #1a1a1a", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ padding: "14px 0" }}>
            <div style={{ fontSize: 10, letterSpacing: 6, color: "#c8a84b", marginBottom: 2 }}>SISTEMA</div>
            <div style={{ fontSize: 18, letterSpacing: 3, fontWeight: "bold" }}>INVENTARIO</div>
          </div>
          <nav style={{ display: "flex", gap: 2 }}>
            {[["stock","STOCK"],["admin","ADMIN"],["ventas","VENTAS"],["historial","HISTORIAL"]].map(([id, label]) => (
              <button key={id} className={`nav-btn ${page===id?"active":""}`} onClick={() => setPage(id)}>{label}</button>
            ))}
          </nav>
        </div>
      </div>

      {/* FEEDBACK TOAST */}
      {feedback && (
        <div className={`feedback ${feedback.type==="err" ? "err" : "ok"}`}
          style={{ border: `1px solid ${feedback.type==="err" ? "#5a1a1a" : "#2a4a2a"}` }}>
          {feedback.msg}
        </div>
      )}

      <input type="file" ref={fileRef} accept="image/*" style={{ display:"none" }} onChange={handlePhoto} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>

        {/* ══ STOCK ══════════════════════════════════════════════════════════ */}
        {page === "stock" && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:24 }}>
              {[
                ["ARTÍCULOS", productos.length],
                ["STOCK TOTAL", productos.reduce((s,p) => s+(p.stock||0), 0)],
                ["VALOR INVENTARIO", "$" + productos.reduce((s,p) => s+(p.precio*(p.stock||0)), 0).toLocaleString()],
              ].map(([label, val]) => (
                <div className="stat-card" key={label}>
                  <div style={{ fontSize:10, letterSpacing:3, color:"#555", marginBottom:8 }}>{label}</div>
                  <div style={{ fontSize:26, color:"#c8a84b" }}>{val}</div>
                </div>
              ))}
            </div>

            <input placeholder="Buscar artículo..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom:16 }} />

            {loading ? (
              <div style={{ textAlign:"center", padding:60, color:"#555" }}><div className="loader" style={{ width:24, height:24 }} /></div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign:"center", padding:60, color:"#333", letterSpacing:2, fontSize:12 }}>SIN ARTÍCULOS</div>
            ) : (
              <div className="grid">
                {filtered.map(item => (
                  <div key={item.id} className="card">
                    {item.foto_url
                      ? <img src={item.foto_url} className="item-photo" alt={item.nombre} />
                      : <div className="item-no-photo" onClick={() => { setPhotoTarget(item.id); fileRef.current.click(); }}>+ FOTO</div>
                    }
                    {item.foto_url && (
                      <div style={{ fontSize:10, color:"#444", marginBottom:8, cursor:"pointer", letterSpacing:2 }}
                        onClick={() => { setPhotoTarget(item.id); fileRef.current.click(); }}>↑ CAMBIAR FOTO</div>
                    )}
                    <div style={{ fontWeight:"bold", marginBottom:4 }}>{item.nombre}</div>
                    {item.specs && <div style={{ fontSize:11, color:"#666", marginBottom:8 }}>{item.specs}</div>}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10 }}>
                      <span style={{ fontSize:18, color:"#c8a84b" }}>${item.precio?.toLocaleString()}</span>
                      <span className={`badge ${(item.stock||0)===0?"err":(item.stock||0)<3?"warn":"ok"}`}>
                        {item.stock||0} uds
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ ADMIN ══════════════════════════════════════════════════════════ */}
        {page === "admin" && (
          <>
            <div style={{ marginBottom:28 }}>
              <div style={{ fontSize:10, letterSpacing:4, color:"#c8a84b", marginBottom:14 }}>CONSOLA DE COMANDOS</div>
              <div style={{ display:"flex", gap:8 }}>
                <input
                  value={cmd}
                  onChange={e => setCmd(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !cmdLoading && handleCmd()}
                  placeholder="nuevo articulo:Auricular Sony;4500$ bluetooth 5.0"
                />
                <button className="btn" onClick={handleCmd} disabled={cmdLoading} style={{ whiteSpace:"nowrap" }}>
                  {cmdLoading ? <span className="loader" /> : "EJECUTAR"}
                </button>
              </div>
              <div className="cmd-help">
                <div><span>nuevo articulo:</span>nombre;<span>precio$</span> specs → crear artículo</div>
                <div><span>precio:</span>nombre;<span>nuevoprecio</span> → cambiar precio</div>
                <div><span>stock:</span>nombre;<span>+N</span> o <span>-N</span> → ajustar stock</div>
                <div><span>venta:</span>nombre;<span>cantidad</span> → registrar venta (descuenta stock)</div>
                <div><span>borrar:</span>nombre → eliminar artículo</div>
              </div>
            </div>

            <div style={{ fontSize:10, letterSpacing:4, color:"#c8a84b", marginBottom:12 }}>TODOS LOS ARTÍCULOS</div>
            {loading ? (
              <div style={{ textAlign:"center", padding:40 }}><div className="loader" /></div>
            ) : (
              <div style={{ overflowX:"auto" }}>
                <table>
                  <thead>
                    <tr><th>ARTÍCULO</th><th>SPECS</th><th>PRECIO</th><th>STOCK</th><th>VENTAS</th><th>FOTO</th></tr>
                  </thead>
                  <tbody>
                    {productos.length === 0
                      ? <tr><td colSpan={6} style={{ textAlign:"center", color:"#333", padding:40, letterSpacing:2 }}>VACÍO</td></tr>
                      : productos.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight:"bold" }}>{p.nombre}</td>
                          <td style={{ color:"#555", fontSize:11 }}>{p.specs||"—"}</td>
                          <td style={{ color:"#c8a84b" }}>${p.precio?.toLocaleString()}</td>
                          <td><span className={`badge ${(p.stock||0)===0?"err":(p.stock||0)<3?"warn":"ok"}`}>{p.stock||0}</span></td>
                          <td style={{ color:"#555" }}>{p.ventas||0}</td>
                          <td>
                            <button className={`btn btn-ghost`} style={{ padding:"4px 10px", fontSize:10 }}
                              onClick={() => { setPhotoTarget(p.id); fileRef.current.click(); }}>
                              {p.foto_url ? "✓ FOTO" : "+ FOTO"}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ══ VENTAS ═════════════════════════════════════════════════════════ */}
        {page === "ventas" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:24, alignItems:"start" }}>

            {/* Lista de productos */}
            <div>
              <div style={{ fontSize:10, letterSpacing:4, color:"#c8a84b", marginBottom:14 }}>SELECCIONAR PRODUCTOS</div>
              <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom:14 }} />
              {loading ? <div style={{ textAlign:"center", padding:40 }}><div className="loader" /></div> : (
                filtered.map(prod => {
                  const qty = ventaCarrito[prod.id] || 0;
                  const agotado = (prod.stock || 0) === 0;
                  return (
                    <div key={prod.id} className="venta-row" style={{ opacity: agotado ? 0.4 : 1 }}>
                      {prod.foto_url
                        ? <img src={prod.foto_url} style={{ width:48, height:48, objectFit:"cover", borderRadius:2, flexShrink:0 }} alt="" />
                        : <div style={{ width:48, height:48, background:"#161616", borderRadius:2, flexShrink:0 }} />
                      }
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:"bold", fontSize:13 }}>{prod.nombre}</div>
                        <div style={{ color:"#c8a84b", fontSize:13 }}>${prod.precio?.toLocaleString()}</div>
                        {prod.specs && <div style={{ color:"#555", fontSize:11 }}>{prod.specs}</div>}
                      </div>
                      <span className={`badge ${agotado?"err":(prod.stock||0)<3?"warn":"ok"}`} style={{ flexShrink:0 }}>
                        {prod.stock||0} uds
                      </span>
                      {/* Selector de cantidad */}
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                        <button className="btn btn-ghost" style={{ padding:"4px 10px", fontSize:16 }} disabled={agotado || qty===0}
                          onClick={() => setVentaCarrito(c => ({ ...c, [prod.id]: Math.max(0, (c[prod.id]||0)-1) }))}>−</button>
                        <input
                          type="number" min={0} max={prod.stock||0} value={qty}
                          className="qty-input"
                          style={{ width:54, textAlign:"center" }}
                          disabled={agotado}
                          onChange={e => {
                            const v = Math.min(prod.stock||0, Math.max(0, parseInt(e.target.value)||0));
                            setVentaCarrito(c => ({ ...c, [prod.id]: v }));
                          }}
                        />
                        <button className="btn btn-ghost" style={{ padding:"4px 10px", fontSize:16 }} disabled={agotado || qty>=(prod.stock||0)}
                          onClick={() => setVentaCarrito(c => ({ ...c, [prod.id]: Math.min(prod.stock||0, (c[prod.id]||0)+1) }))}>+</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Carrito / resumen */}
            <div style={{ position:"sticky", top:16 }}>
              <div className="card" style={{ border:"1px solid #2a2a1a" }}>
                <div style={{ fontSize:10, letterSpacing:4, color:"#c8a84b", marginBottom:14 }}>RESUMEN DE VENTA</div>
                {Object.entries(ventaCarrito).filter(([,q]) => q>0).length === 0
                  ? <div style={{ color:"#333", fontSize:12, letterSpacing:2, textAlign:"center", padding:"20px 0" }}>CARRITO VACÍO</div>
                  : Object.entries(ventaCarrito).filter(([,q]) => q>0).map(([id, qty]) => {
                    const p = productos.find(x => x.id === id);
                    if (!p) return null;
                    return (
                      <div key={id} style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:12 }}>
                        <span style={{ color:"#aaa" }}>{p.nombre} ×{qty}</span>
                        <span style={{ color:"#c8a84b" }}>${(p.precio*qty).toLocaleString()}</span>
                      </div>
                    );
                  })
                }
                <div style={{ borderTop:"1px solid #222", marginTop:14, paddingTop:14, display:"flex", justifyContent:"space-between", marginBottom:16 }}>
                  <span style={{ fontSize:11, letterSpacing:2, color:"#555" }}>TOTAL</span>
                  <span style={{ fontSize:20, color:"#c8a84b", fontWeight:"bold" }}>${totalCarrito.toLocaleString()}</span>
                </div>
                <button className="btn" style={{ width:"100%" }} disabled={totalCarrito===0||ventaLoading} onClick={registrarVenta}>
                  {ventaLoading ? <span className="loader" /> : "CONFIRMAR VENTA"}
                </button>
                {totalCarrito > 0 && (
                  <button className="btn btn-ghost btn-red" style={{ width:"100%", marginTop:8 }} onClick={() => setVentaCarrito({})}>
                    LIMPIAR
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ HISTORIAL ══════════════════════════════════════════════════════ */}
        {page === "historial" && (
          <>
            <div style={{ fontSize:10, letterSpacing:4, color:"#c8a84b", marginBottom:14 }}>ÚLTIMAS 50 VENTAS</div>
            {histLoading ? (
              <div style={{ textAlign:"center", padding:60 }}><div className="loader" style={{ width:24, height:24 }} /></div>
            ) : (
              <div style={{ overflowX:"auto" }}>
                <table>
                  <thead>
                    <tr><th>FECHA</th><th>ARTÍCULO</th><th>CANTIDAD</th><th>PRECIO UNIT.</th><th>TOTAL</th></tr>
                  </thead>
                  <tbody>
                    {historial.length === 0
                      ? <tr><td colSpan={5} style={{ textAlign:"center", color:"#333", padding:40, letterSpacing:2 }}>SIN VENTAS</td></tr>
                      : historial.map(v => (
                        <tr key={v.id}>
                          <td style={{ color:"#555", fontSize:11 }}>{new Date(v.fecha).toLocaleString("es-AR")}</td>
                          <td style={{ fontWeight:"bold" }}>{v.productos?.nombre || "—"}</td>
                          <td>{v.cantidad}</td>
                          <td style={{ color:"#c8a84b" }}>${v.precio_unitario?.toLocaleString()}</td>
                          <td style={{ color:"#4caf50", fontWeight:"bold" }}>${v.total?.toLocaleString()}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
